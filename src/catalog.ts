export type CatalogBook = {
  id: string;
  title: string;
  author: string;
  language: string;
  format: string;
  size?: string;
  url: string;
  downloadUrl?: string;
  coverUrl?: string;
  provider?: string;
  metadata?: string;
  md5?: string;
};
export type CatalogResult = {
  results: CatalogBook[];
  page: number;
  hasMore: boolean;
  count?: number;
  challenge?: boolean;
  error?: string;
  query?: string;
  language?: string;
  format?: string;
  provider?: string;
};
export type DownloadOption = {id:string;label:string;url:string;kind:"direct"|"page"};
export type CatalogLinks = {options:DownloadOption[];error?:string;challenge?:boolean};
