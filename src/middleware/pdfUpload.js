
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

// Raiz do projeto: um nível acima de src/
const projectRoot = path.resolve(currentDir, "../..");
const uploadDir = path.join(projectRoot, "private_uploads");

fs.mkdirSync(uploadDir, { recursive: true });

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDir);
  },

  filename: (_req, _file, callback) => {
    // Nome aleatório para evitar colisões e preservar o nome original.
    callback(null, `${crypto.randomUUID()}.pdf`);
  }
});

const fileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (extension !== ".pdf" || file.mimetype !== "application/pdf") {
    return callback(
      new Error("Envie somente arquivos PDF.")
    );
  }

  callback(null, true);
};

const pdfUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

export default pdfUpload;
