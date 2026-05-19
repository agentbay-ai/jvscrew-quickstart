import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getFileUploadUrl, uploadFileToOSS, syncContext } from '../services/api';

interface UploadResult {
  sandboxPath: string;
  fileKey: string;
}

export function useFileUpload() {
  const config = useAuthStore((s) => s.config);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState('');

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      if (!config) return null;
      setIsUploading(true);

      try {
        setProgress('Getting upload URL...');
        const urlData = await getFileUploadUrl(config, file.name);
        if (!urlData.Success) {
          throw new Error(urlData.Message || 'Failed to get upload URL');
        }

        setProgress('Uploading file...');
        await uploadFileToOSS(urlData.UploadUrl, file, urlData.UploadHeadersHint);

        setProgress('Syncing to sandbox...');
        const syncData = await syncContext(config, urlData.FileKey);
        if (!syncData.Success) {
          throw new Error(syncData.Message || 'Failed to sync file');
        }

        setProgress('Done');
        return {
          sandboxPath: urlData.SandboxPath,
          fileKey: urlData.FileKey,
        };
      } catch (err) {
        setProgress(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [config],
  );

  return { uploadFile, isUploading, progress };
}
