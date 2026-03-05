import { gapi } from 'gapi-script';

export const loadGooglePickerScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    gapi.load('picker', {
      callback: () => resolve(),
      onerror: () => reject(new Error('Failed to load Google Picker API')),
    });
  });
};

export const createDriveFile = async (fileName: string, content: string, token: string): Promise<string> => {
  const fileMetadata = {
    name: fileName,
    mimeType: 'text/markdown',
  };

  const fileContent = new Blob([content], { type: 'text/markdown' });

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
  form.append('file', fileContent);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Error creating file: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
};

export const updateDriveFile = async (fileId: string, content: string, token: string): Promise<void> => {
  const fileContent = new Blob([content], { type: 'text/markdown' });

  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/markdown',
    },
    body: fileContent,
  });

  if (!response.ok) {
    throw new Error(`Error updating file: ${response.statusText}`);
  }
};

export const downloadDriveFile = async (fileId: string, token: string): Promise<string> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error downloading file: ${response.statusText}`);
  }

  return await response.text();
};

export const getDriveFileMetadata = async (fileId: string, token: string): Promise<{name: string}> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Error fetching metadata: ${response.statusText}`);
  }

  return await response.json();
};
