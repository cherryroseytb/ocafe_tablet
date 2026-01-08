export function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      // Does this cookie string begin with the name we want?
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

export function isFirefox() {
  return /Firefox/i.test(navigator.userAgent);
}

export async function getAllFilesFromDataTransfer(dataTransfer) {
  const result = [];

  const collectEntries = async (entries, parentPath = "") => {
    const promises = entries.map(async (entry) => {
      const fullPath = parentPath + entry.name;

      if (entry.isFile) {
        // Wrap entry.file() in a Promise to await the file object
        const file = await new Promise((resolve) => {
          entry.file(resolve);
        });
        result.push(file);
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        // Read directory contents using a Promise
        const contents = await new Promise((resolve) => {
          dirReader.readEntries(resolve);
        });
        // Recursively process directory contents
        await collectEntries(contents, fullPath + "/");
      }
    });

    // Ensure all entries/promises complete
    await Promise.all(promises);
  };

  // Create a promise for each dropped item
  const filePromises = Array.from(dataTransfer.items).map((item) => {
    return new Promise(async (resolveItem) => {
      const entry = item.webkitGetAsEntry(); // Firefox에서는 undefined

      if (!entry) {
        const file = item.getAsFile(); // File from clipboard or non-directory drag
        file && result.push(file);
        resolveItem();
      } else if (entry.isFile) {
        const file = await new Promise((resolve) => {
          entry.file(resolve);
        });
        result.push(file);
        resolveItem();
      } else if (entry.isDirectory) {
        // Await directory traversal before resolving
        await collectEntries([entry]);
        resolveItem();
      }
    });
  });

  await Promise.all(filePromises);
  return result;
}
