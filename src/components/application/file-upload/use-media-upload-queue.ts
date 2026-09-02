import { useCallback, useEffect, useRef, useState } from "react";

export type UploadedMedia = { url: string; name: string; kind: string };

export type UploadProgressItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "reading" | "uploading" | "complete" | "failed";
  error?: string | undefined;
};

function readAsDataUrl(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.max(5, Math.round((event.loaded / event.total) * 45)));
      }
    };
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

export function useMediaUploadQueue({
  upload,
  uploadedCount,
  onUploaded,
  onError,
  maxFiles = 4,
  maxSizeBytes = 15_000_000,
}: {
  upload: (fileName: string, dataUrl: string) => Promise<UploadedMedia>;
  uploadedCount: number;
  onUploaded: (media: UploadedMedia) => void;
  onError?: (error: Error, file: File) => void;
  maxFiles?: number;
  maxSizeBytes?: number;
}) {
  const [items, setItems] = useState<UploadProgressItem[]>([]);
  const files = useRef(new Map<string, File>());
  const completionTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(
    () => () => {
      completionTimers.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const update = useCallback((id: string, patch: Partial<UploadProgressItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const runUpload = useCallback(
    async (id: string, file: File) => {
      try {
        update(id, { status: "reading", progress: 5, error: undefined });
        const dataUrl = await readAsDataUrl(file, (progress) => update(id, { progress }));
        update(id, { status: "uploading", progress: 65 });
        const media = await upload(file.name, dataUrl);
        onUploaded(media);
        files.current.delete(id);
        update(id, { status: "complete", progress: 100 });
        const timer = setTimeout(() => {
          setItems((current) => current.filter((item) => item.id !== id));
          completionTimers.current.delete(timer);
        }, 1200);
        completionTimers.current.add(timer);
      } catch (cause) {
        const error = cause instanceof Error ? cause : new Error("Upload failed.");
        update(id, { status: "failed", progress: 0, error: error.message });
        onError?.(error, file);
      }
    },
    [onError, onUploaded, update, upload],
  );

  const addFiles = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return;
      const activeCount = items.filter((item) => item.status !== "complete").length;
      const accepted = Array.from(list).slice(
        0,
        Math.max(0, maxFiles - uploadedCount - activeCount),
      );

      for (const file of accepted) {
        const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${file.name}`;
        files.current.set(id, file);
        setItems((current) => [
          ...current,
          {
            id,
            name: file.name,
            size: file.size,
            progress: 0,
            status: file.size > maxSizeBytes ? "failed" : "reading",
            error: file.size > maxSizeBytes ? "File is larger than 15 MB." : undefined,
          },
        ]);
        if (file.size <= maxSizeBytes) await runUpload(id, file);
      }
    },
    [items, maxFiles, maxSizeBytes, runUpload, uploadedCount],
  );

  const retry = useCallback(
    (id: string) => {
      const file = files.current.get(id);
      if (file) void runUpload(id, file);
    },
    [runUpload],
  );

  const remove = useCallback((id: string) => {
    files.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    items,
    isUploading: items.some((item) => item.status === "reading" || item.status === "uploading"),
    addFiles,
    retry,
    remove,
  };
}
