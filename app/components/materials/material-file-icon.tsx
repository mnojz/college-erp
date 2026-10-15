import type { ElementType } from "react";
import {
  IconFileTypePdf,
  IconFileTypeDocx,
  IconFileTypePpt,
  IconFileTypeXls,
  IconFileTypeZip,
  IconPhoto,
  IconVideo,
  IconMusic,
  IconCode,
  IconFile,
} from "@tabler/icons-react";

export type FileIconInfo = {
  Icon: ElementType;
  color: string;
  bg: string;
};

export function getFileIconInfo(fileName: string): FileIconInfo {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  // PDF
  if (ext === "pdf") {
    return {
      Icon: IconFileTypePdf,
      color: "text-red-500 dark:text-red-400",
      bg: "bg-red-500/15",
    };
  }
  // Word / Text docs
  if (["doc", "docx", "odt", "rtf", "txt", "md"].includes(ext)) {
    return {
      Icon: IconFileTypeDocx,
      color: "text-blue-500 dark:text-blue-400",
      bg: "bg-blue-500/15",
    };
  }
  // Presentations / Slides
  if (["ppt", "pptx", "key", "odp"].includes(ext)) {
    return {
      Icon: IconFileTypePpt,
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500/15",
    };
  }
  // Spreadsheets
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) {
    return {
      Icon: IconFileTypeXls,
      color: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-500/15",
    };
  }
  // Archives
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return {
      Icon: IconFileTypeZip,
      color: "text-purple-500 dark:text-purple-400",
      bg: "bg-purple-500/15",
    };
  }
  // Images
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(ext)) {
    return {
      Icon: IconPhoto,
      color: "text-sky-500 dark:text-sky-400",
      bg: "bg-sky-500/15",
    };
  }
  // Videos
  if (["mp4", "webm", "mkv", "mov", "avi", "wmv"].includes(ext)) {
    return {
      Icon: IconVideo,
      color: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-500/15",
    };
  }
  // Audio
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) {
    return {
      Icon: IconMusic,
      color: "text-teal-500 dark:text-teal-400",
      bg: "bg-teal-500/15",
    };
  }
  // Code
  if (["py", "js", "ts", "jsx", "tsx", "c", "cpp", "java", "html", "css", "json", "sql", "sh"].includes(ext)) {
    return {
      Icon: IconCode,
      color: "text-indigo-500 dark:text-indigo-400",
      bg: "bg-indigo-500/15",
    };
  }
  // Fallback for niche or unknown files
  return {
    Icon: IconFile,
    color: "text-muted-foreground",
    bg: "bg-muted",
  };
}

