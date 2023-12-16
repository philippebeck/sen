"use strict";

const db          = require("../model");
const formidable  = require("formidable");
const fs          = require("fs");
const nem         = require("nemjs");

require("dotenv").config();

const ARTICLES_IMG    = process.env.IMG_URL + "articles/";
const ARTICLES_THUMB  = process.env.THUMB_URL + "articles/";

const Article = db.article;
const form    = formidable({ uploadDir: ARTICLES_IMG, keepExtensions: true });

//! ******************** UTILS ********************

/**
 * ? CHECK ARTICLE DATA
 * * Checks the validity of article data.
 *
 * @param {string} name - The name of the article.
 * @param {string} text - The text of the article.
 * @param {string} alt - The alternative text for the article.
 * @param {string} cat - The category of the article.
 * @param {Object} res - The response object.
 * @return {object} The response object with an error message if the article is not correct.
 */
exports.checkArticleData = (name, text, alt, cat, res) => {
  const STR_MAX = process.env.STRING_MAX;
  const STR_MIN = process.env.STRING_MIN;
  const TXT_MAX = process.env.TEXT_MAX;
  const TXT_MIN = process.env.TEXT_MIN;

  let alert = "";

  if (!nem.checkRange(cat, STR_MIN, STR_MAX)) alert = process.env.CHECK_CAT;
  if (!nem.checkRange(alt, STR_MIN, STR_MAX)) alert = process.env.CHECK_NAME;
  if (!nem.checkRange(text, TXT_MIN, TXT_MAX)) alert = process.env.CHECK_TEXT;
  if (!nem.checkRange(name, STR_MIN, STR_MAX)) alert = process.env.CHECK_NAME;

  if (alert !== "") return res.status(403).json({ message: alert });
}

/**
 * ? CHECK ARTICLE UNIQUE
 * * Checks if an article is unique based on its name & text.
 *
 * @param {string} name - The name of the article.
 * @param {string} text - The text of the article.
 * @param {object} article - The existing article to compare with.
 * @param {object} res - The response object used to send the result.
 * @return {object} The response object with an error message if the article is not unique.
 */
exports.checkArticleUnique = (name, text, article, res) => {
  if (article.name === name) {
    return res.status(403).json({ message: process.env.DISPO_NAME });
  }

  if (article.text === text) {
    return res.status(403).json({ message: process.env.DISPO_TEXT });
  }
}

/**
 * ? SET IMAGE
 * * Sets the image for an article.
 *
 * @param {string} name - The name of the article.
 * @param {string} newFilename - The new filename of the image.
 */
exports.setImage = (name, newFilename) => {
  let input   = "articles/" + newFilename;
  let output  = "articles/" + name;

  nem.setThumbnail(input, process.env.THUMB_URL + output);
  nem.setThumbnail(
    input,
    process.env.IMG_URL + output,
    process.env.IMG_WIDTH,
    process.env.IMG_HEIGHT
  );
}

//! ******************** PUBLIC ********************

/**
 * ? LIST ARTICLES
 * * Retrieves a list of articles.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @return {Object} The JSON response containing the list of articles.
 * @throws {Error} If the articles are not found in the database.
 */
exports.listArticles = (req, res) => {
  Article
    .findAll()
    .then((articles) => { res.status(200).json(articles) })
    .catch(() => res.status(404).json({ message: process.env.ARTICLES_NOT_FOUND }));
}

/**
 * ? READ ARTICLE
 * * Retrieves an article by its ID & sends it as a JSON response.
 *
 * @param {Object} req - The HTTP request object.
 * @param {Object} res - The HTTP response object.
 * @return {Object} The retrieved article as a JSON response.
 * @throws {Error} If the article is not found in the database.
 */
exports.readArticle = (req, res) => {
  Article
    .findByPk(parseInt(req.params.id))
    .then((article) => { res.status(200).json(article) })
    .catch(() => res.status(404).json({ message: process.env.ARTICLE_NOT_FOUND }));
}

//! ******************** PRIVATE ********************

// TODO : create a method to like an article

/**
 * ? CREATE ARTICLE
 * * Creates an article based on the request data.
 *
 * @param {Object} req - the request object
 * @param {Object} res - the response object
 * @param {Function} next - the next function in the middleware chain
 * @return {Object} A message indicating that the article was created.
 * @throws {Error} If the article is not created in the database.
 */
exports.createArticle = (req, res, next) => {
  form.parse(req, (err, fields, files) => {
    if (err) { next(err); return }

    this.checkArticleData(fields.name, fields.text, fields.alt, fields.cat, res);

    Article
      .findAll()
      .then((articles) => {
        for (let article of articles) {
          this.checkArticleUnique(fields.name, fields.text, article, res)
        }

        let image = nem.getName(fields.name) + "." + process.env.IMG_EXT;
        this.setImage(image, files.image.newFilename);

        let article = {
          name: fields.name,
          text: fields.text,
          image: image,
          alt: fields.alt,
          cat: fields.cat
        }

        Article
          .create(article)
          .then(() => {
            fs.unlink(ARTICLES_IMG + files.image.newFilename, () => {
              res.status(201).json({ message: process.env.ARTICLE_CREATED })
            })
          })
          .catch(() => res.status(400).json({ message: process.env.ARTICLE_NOT_CREATED }));
      })
      .catch(() => res.status(404).json({ message: process.env.ARTICLES_NOT_FOUND }));
  })
}

/**
 * ? UPDATE ARTICLE
 * * Updates an article based on the request.
 *
 * @param {Object} req - the request object
 * @param {Object} res - the response object
 * @param {Function} next - the next middleware function
 * @return {Object} A message indicating that the article was updated.
 * @throws {Error} If the article is not updated in the database.
 */
exports.updateArticle = (req, res, next) => {
  const id = parseInt(req.params.id);

  form.parse(req, (err, fields, files) => {
    if (err) { next(err); return }

    this.checkArticleData(fields.name, fields.text, fields.alt, fields.cat, res);

    Article
      .findAll()
      .then((articles) => {
        for (let article of articles) {
          if (article.id !== id) this.checkArticleUnique(fields.name, fields.text, article, res);
        }

        let image = nem.getName(fields.name) + "." + process.env.IMG_EXT;
        if (files.image) this.setImage(image, files.image.newFilename);

        let article = {
          name: fields.name,
          text: fields.text,
          image: image,
          alt: fields.alt,
          likes: fields.likes,
          cat: fields.cat
        }

        Article
          .update(article, { where: { id: id }})
          .then(() => {
            if (files.image) fs.unlink(ARTICLES_IMG + files.image.newFilename, () => { });
            res.status(200).json({ message: process.env.ARTICLE_UPDATED });
          })
          .catch(() => res.status(400).json({ message: process.env.ARTICLE_NOT_UPDATED }));
      })
      .catch(() => res.status(404).json({ message: process.env.ARTICLES_NOT_FOUND }));
  })
}

/**
 * ? DELETE ARTICLE
 * * Deletes an article from the database.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @return {Object} A message indicating that the article was deleted.
 * @throws {Error} If the article is not deleted in the database.
 */
exports.deleteArticle = (req, res) => {
  const id = parseInt(req.params.id);

  Article
    .findByPk(id)
    .then(article => {
      fs.unlink(ARTICLES_THUMB + article.image, () => {
        fs.unlink(ARTICLES_IMG + article.image, () => {

          Article
            .destroy({ where: { id: id }})
            .then(() => res.status(204).json({ message: process.env.ARTICLE_DELETED }))
            .catch(() => res.status(400).json({ message: process.env.ARTICLE_NOT_DELETED }))
        });
      })
    })
    .catch(() => res.status(404).json({ message: process.env.ARTICLE_NOT_FOUND }));
}
