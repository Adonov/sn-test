import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';

/** Opens the camera and returns the scanned barcode, or undefined when the user cancels. */
export async function scanBarcode(instructions: string): Promise<string | undefined> {
  try {
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.ALL,
      scanInstructions: instructions,
    });
    return result.ScanResult?.trim() || undefined;
  } catch {
    return undefined; // cancelled or no camera permission
  }
}
