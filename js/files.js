import { state, getAuthHeaders, MAX_FILE_CHARS } from "./state.js";

async function uploadLargeMediaToWorker(file) {
  const base = state.apiUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/upload`, {
    method: "POST",
    headers: getAuthHeaders({
      "X-File-Name": encodeURIComponent(file.name),
      "X-Mime-Type": file.type || "application/octet-stream"
    }),
    body: file
  });
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return {
    type: "file_uri",
    name: data.name || file.name,
    mimeType: data.mimeType || file.type,
    fileUri: data.fileUri
  };
}

export async function extractFilePayload(file) {
  const name = file.name;
  const mimeType = file.type || "application/octet-stream";

  if ((mimeType.startsWith("audio/") || mimeType.startsWith("video/")) && file.size > 0) {
    return await uploadLargeMediaToWorker(file);
  }

  if (mimeType.startsWith("image/")) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const base64Data = String(dataUrl).split(",")[1] || "";
    return {
      type: "inline",
      name,
      mimeType,
      data: base64Data,
      dataUrl
    };
  }

  if (name.toLowerCase().endsWith(".pptx") && window.JSZip) {
    const buf = await file.arrayBuffer();
    const zip = await window.JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files)
      .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
      .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));

    const slides = [];
    for (const sf of slideFiles) {
      const xml = await zip.files[sf].async("string");
      const plain = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (plain) slides.push(`[Slide ${slides.length + 1}] ${plain}`);
    }

    const mediaFiles = Object.keys(zip.files)
      .filter((f) => /^ppt\/media\/.+\.(png|jpg|jpeg|webp)$/i.test(f))
      .slice(0, 12);

    const slideImages = [];
    for (let i = 0; i < mediaFiles.length; i++) {
      const mf = mediaFiles[i];
      const b64 = await zip.files[mf].async("base64");
      const ext = mf.split(".").pop().toLowerCase();
      slideImages.push({
        slideLabel: `Embedded Diagram ${i + 1}`,
        mimeType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
        data: b64
      });
    }

    return {
      type: "pptx",
      name,
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      slideCount: slideFiles.length,
      slidesText: slides.join("\n").slice(0, MAX_FILE_CHARS),
      slideImages
    };
  }

  if (name.toLowerCase().endsWith(".pdf") && window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const maxPages = Math.min(pdf.numPages, 80);
    const pages = [];
    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const line = content.items.map((it) => it.str).join(" ");
      if (line.trim()) pages.push(`[Page ${p}] ${line.trim()}`);
    }
    return {
      type: "text",
      name,
      mimeType: "application/pdf",
      content: pages.join("\n").slice(0, MAX_FILE_CHARS)
    };
  }

  const text = await file.text();
  return {
    type: "text",
    name,
    mimeType: "text/plain",
    content: text.slice(0, MAX_FILE_CHARS)
  };
}
