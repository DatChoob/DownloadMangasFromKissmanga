const puppeteer = require("puppeteer");
const fs = require("fs");
const request = require("request");

//add to this list
let mangasToSave = [
  "https://kissmanga.com/Manga/Star-Martial-God-Technique",
  "https://kissmanga.com/Manga/Moshi-Fanren",
  "https://kissmanga.com/Manga/Tsuki-ga-Michibiku-Isekai-Douchuu",
  "https://kissmanga.com/Manga/Sweet-Home-KIM-Carnby",
  "https://kissmanga.com/Manga/Tower-of-God",
  "https://kissmanga.com/Manga/Douluo-Dalu-3-The-Legend-of-the-Dragon-King"
];
const since_date = "6/15/2019";

(async () => {
  // Set up browser and page.
  const browser = await puppeteer.launch();

  await Promise.all(
    mangasToSave.map(async mangaUrl => {
      try {
        let page = await browser.newPage();
        page.setViewport({ width: 1280, height: 926 });
        await page.goto(mangaUrl, { timeout: 0, waitUntil: "load" });
        let mangaInfo = await getMangaInfoWithChapterLinks(page);
        mangaInfo = await getImageUrlsForChapters(mangaInfo, page);
        await saveImages(mangaInfo);
        page.close();
      } catch (e) {
        console.error(mangaUrl, e);
      }
    })
  );

  await browser.close();
})();

function processChapterListing(rows, since_date) {
  //since date is tunable
  let chapters = [];
  for (let i = 2; i < rows.length; i++) {
    let dateUploaded = rows[i].cells[1].innerHTML.trim();
    if (new Date(dateUploaded) >= new Date(since_date)) {
      chapterLink = rows[i].cells[0].querySelector("a").href;
      chapters.push({
        title: rows[i].cells[0].innerText,
        link: chapterLink,
        dateUploaded: dateUploaded
      });
    } else {
      //skip the rest since they are all older
      break;
    }
  }
  return chapters;
}

async function getMangaInfoWithChapterLinks(page) {
  await page.waitForSelector(".listing", { timeout: 0, waitUntil: "load" });
  let chapters = await page.$$eval(
    ".listing tr",
    processChapterListing,
    since_date
  );
  return {
    title: await page.$eval(".bigChar", el => el.innerHTML),
    chapters: chapters
  };
}
async function getImageUrlsForChapters(manga, page) {
  for (let i = 0; i < manga.chapters.length; i++) {
    await page.goto(manga.chapters[i].link, { timeout: 0, waitUntil: "load" });
    await page.waitForSelector("#divImage", { timeout: 0, waitUntil: "load" });

    let chapterImageUrls = await page.$$eval("#divImage img", images => {
      const imageUrls = [];
      for (let image of images) {
        imageUrls.push(image.src);
      }
      return imageUrls;
    });

    manga.chapters[i].imageUrls = chapterImageUrls;
    return manga;
  }
}

async function saveImages(mangaInfo) {
  console.log("starting saving " + mangaInfo.title);
  let i = 1;
  for (const chapter of mangaInfo.chapters) {
    if (chapter.title.startsWith(mangaInfo.title)) {
      chapter.title = chapter.title.slice(mangaInfo.title.length);
    }
    let dir =
      "./manga/" +
      mangaInfo.title +
      "/" +
      chapter.dateUploaded.replace(/\//g, "\\") +
      " - " +
      chapter.title;
    await fs.mkdir(dir, { recursive: true }, err => {
      if (err) console.log(err);
      else {
        for (const url of chapter.imageUrls) {
          let saveImgPath = dir + "/page" + i++ + ".jpg";
          request(url).pipe(fs.createWriteStream(saveImgPath));
        }
      }
    });
  }
  console.log("finished saving " + mangaInfo.title);
}
