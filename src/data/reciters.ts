import type { AppLanguage } from '../utils/i18n';

export interface Reciter {
  id: string;
  name: string;
  englishName?: string;
  style: string;
  englishStyle?: string;
  country: string;
  englishCountry?: string;
  serverKey: string;
  quranComRecitationId?: number;
}

export const RECITERS_LIST: Reciter[] = [
  {
    id: 'alafasy',
    name: 'مشاري راشد العفاسي',
    englishName: 'Mishary Rashid Alafasy',
    style: 'مرتل',
    englishStyle: 'Murattal',
    country: 'الكويت',
    englishCountry: 'Kuwait',
    serverKey: 'Alafasy_128kbps',
    quranComRecitationId: 7,
  },
  {
    id: 'husary',
    name: 'محمود خليل الحصري (المعلم)',
    englishName: 'Mahmoud Khalil Al-Husary (Muallim)',
    style: 'مرتل · تعليمي',
    englishStyle: 'Murattal · Teaching',
    country: 'مصر',
    englishCountry: 'Egypt',
    serverKey: 'Husary_128kbps',
    quranComRecitationId: 6,
  },
  {
    id: 'minshawi',
    name: 'محمد صديق المنشاوي',
    englishName: 'Muhammad Siddiq Al-Minshawi',
    style: 'مرتل',
    englishStyle: 'Murattal',
    country: 'مصر',
    englishCountry: 'Egypt',
    serverKey: 'Minshawy_Murattal_128kbps',
    quranComRecitationId: 9,
  },
  {
    id: 'abdulbasit',
    name: 'عبد الباسط عبد الصمد',
    englishName: 'Abdul Basit Abdul Samad',
    style: 'مرتل',
    englishStyle: 'Murattal',
    country: 'مصر',
    englishCountry: 'Egypt',
    serverKey: 'Abdul_Basit_Murattal_192kbps',
    quranComRecitationId: 2,
  },
  {
    id: 'sudais',
    name: 'عبد الرحمن السديس',
    englishName: 'Abdur-Rahman As-Sudais',
    style: 'مرتل',
    englishStyle: 'Murattal',
    country: 'السعودية',
    englishCountry: 'Saudi Arabia',
    serverKey: 'Abdurrahmaan_As-Sudais_192kbps',
    quranComRecitationId: 3,
  },
  {
    id: 'shuraim',
    name: 'سعود الشريم',
    englishName: "Sa'ud Ash-Shuraim",
    style: 'مرتل',
    englishStyle: 'Murattal',
    country: 'السعودية',
    englishCountry: 'Saudi Arabia',
    serverKey: 'Saood_ash-Shuraym_128kbps',
    quranComRecitationId: 10,
  },
  {
    id: 'ghamdi',
    name: 'سعد الغامدي',
    englishName: "Sa'd Al-Ghamdi",
    style: 'مرتل',
    englishStyle: 'Murattal',
    country: 'السعودية',
    englishCountry: 'Saudi Arabia',
    serverKey: 'Ghamadi_40kbps',
  },
  {
    id: 'ajamy',
    name: 'أحمد بن علي العجمي',
    englishName: 'Ahmad bin Ali Al-Ajamy',
    style: 'مرتل',
    englishStyle: 'Murattal',
    country: 'السعودية',
    englishCountry: 'Saudi Arabia',
    serverKey: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net',
  },
  {
    id: 'maher',
    name: 'ماهر المعيقلي',
    englishName: 'Maher Al-Muaiqly',
    style: 'مرتل',
    englishStyle: 'Murattal',
    country: 'السعودية',
    englishCountry: 'Saudi Arabia',
    serverKey: 'MaherAlMuaiqly128kbps',
  },
];

export function getReciterDisplayName(reciter: Reciter, lang: AppLanguage): string {
  return lang === 'en' ? reciter.englishName || reciter.name : reciter.name;
}

export function getReciterDisplayStyle(reciter: Reciter, lang: AppLanguage): string {
  return lang === 'en' ? reciter.englishStyle || reciter.style : reciter.style;
}

export function getReciterDisplayCountry(reciter: Reciter, lang: AppLanguage): string {
  return lang === 'en' ? reciter.englishCountry || reciter.country : reciter.country;
}

export function getAyahAudioUrl(
  serverKey: string,
  surahNumber: number,
  ayahNumber: number
): string {
  const s = String(Math.max(1, Math.min(114, Math.floor(surahNumber)))).padStart(3, '0');
  const a = String(Math.max(1, Math.floor(ayahNumber))).padStart(3, '0');
  return `https://everyayah.com/data/${serverKey}/${s}${a}.mp3`;
}

