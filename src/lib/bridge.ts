// Access to the Electron preload API; undefined when running in a plain browser.
export interface TourTimeBridge {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<boolean>;
  importDocuments(): Promise<{ originalName: string; storedName: string; size: number }[]>;
  openDocument(storedName: string): Promise<string>;
  revealDocument(storedName: string): Promise<void>;
  deleteDocument(storedName: string): Promise<void>;
  saveReportPdf(name: string): Promise<string | null>;
  printReport(): Promise<void>;
  hostChat(opts: { enabled: boolean; port: number }): Promise<{ hosting: boolean; port: number | null }>;
}

declare global {
  interface Window {
    tourTime?: TourTimeBridge;
  }
}

export const bridge = (): TourTimeBridge | undefined => window.tourTime;
