/**
 * Mobile-safe file download utility.
 * - Capacitor native (Android/iOS app): writes to cache + opens share sheet
 * - Web (desktop + mobile browser): uses data URI anchor click (avoids async-blocked blob URLs)
 */
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function downloadExcel(
  wb: XLSX.WorkBook,
  fileName: string,
  shareTitle = 'Download Template'
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    await Share.share({ title: shareTitle, url: savedFile.uri, dialogTitle: 'Save or Share' });
  } else {
    // Data URI works on both desktop and mobile browsers (avoids async-blocked blob URLs)
    const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
    const a = document.createElement('a');
    a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export async function downloadCSV(
  csvContent: string,
  fileName: string,
  shareTitle = 'Download Template'
): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: csvContent,
      encoding: 'utf8' as any,
      directory: Directory.Cache,
    });
    await Share.share({ title: shareTitle, url: savedFile.uri, dialogTitle: 'Save or Share' });
  } else {
    // btoa with encodeURIComponent handles unicode characters in CSV
    const base64 = btoa(unescape(encodeURIComponent(csvContent)));
    const a = document.createElement('a');
    a.href = `data:text/csv;base64,${base64}`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
