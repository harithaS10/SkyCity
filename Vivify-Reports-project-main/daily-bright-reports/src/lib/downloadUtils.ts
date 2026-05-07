/**
 * Mobile-safe file download utility.
 * - Capacitor native (Android/iOS app): writes to cache + opens share sheet
 * - Web (desktop + mobile browser): uses data URI anchor click (avoids async-blocked blob URLs)
 */
import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast } from 'sonner';

export async function downloadExcel(
  wb: XLSX.WorkBook,
  fileName: string,
  shareTitle = 'Download Template'
): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      console.log('Native platform detected, using Capacitor APIs');
      
      // Generate Excel file as base64
      const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      console.log('Excel file generated, size:', base64.length);
      
      // Write to cache directory
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });
      console.log('File saved to:', savedFile.uri);
      
      // Check if Share is available
      const canShare = await Share.canShare();
      console.log('Can share:', canShare);
      
      if (canShare.value) {
        // Share the file
        await Share.share({ 
          title: shareTitle, 
          url: savedFile.uri, 
          dialogTitle: 'Save or Share File' 
        });
        toast.success('File ready to share');
      } else {
        toast.error('Sharing not available on this device');
      }
    } else {
      console.log('Web platform detected, using data URI');
      
      // Data URI works on both desktop and mobile browsers (avoids async-blocked blob URLs)
      const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const a = document.createElement('a');
      a.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      
      // Trigger click with a small delay for mobile browsers
      setTimeout(() => {
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          toast.success('Download started');
        }, 100);
      }, 100);
    }
  } catch (error: any) {
    console.error('Download error:', error);
    toast.error(`Failed to download: ${error.message || 'Unknown error'}`);
  }
}

export async function downloadCSV(
  csvContent: string,
  fileName: string,
  shareTitle = 'Download Template'
): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      console.log('Native platform detected, using Capacitor APIs');
      
      // Write CSV to cache directory
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: csvContent,
        encoding: 'utf8' as any,
        directory: Directory.Cache,
      });
      console.log('CSV file saved to:', savedFile.uri);
      
      // Check if Share is available
      const canShare = await Share.canShare();
      console.log('Can share:', canShare);
      
      if (canShare.value) {
        // Share the file
        await Share.share({ 
          title: shareTitle, 
          url: savedFile.uri, 
          dialogTitle: 'Save or Share File' 
        });
        toast.success('File ready to share');
      } else {
        toast.error('Sharing not available on this device');
      }
    } else {
      console.log('Web platform detected, using data URI');
      
      // btoa with encodeURIComponent handles unicode characters in CSV
      const base64 = btoa(unescape(encodeURIComponent(csvContent)));
      const a = document.createElement('a');
      a.href = `data:text/csv;base64,${base64}`;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      
      // Trigger click with a small delay for mobile browsers
      setTimeout(() => {
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          toast.success('Download started');
        }, 100);
      }, 100);
    }
  } catch (error: any) {
    console.error('Download error:', error);
    toast.error(`Failed to download: ${error.message || 'Unknown error'}`);
  }
}
