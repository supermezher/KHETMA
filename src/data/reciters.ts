export interface Reciter {
  id: string;
  name: string;
  style: string;
  country: string;
  serverKey: string;
  quranComRecitationId?: number;
}

export const RECITERS_LIST: Reciter[] = [
  {
    id: 'alafasy',
    name: 'مشاري راشد العفاسي',
    style: 'مرتل',
    country: 'الكويت',
    serverKey: 'Alafasy_128kbps',
    quranComRecitationId: 7,
  },
  {
    id: 'husary',
    name: 'محمود خليل الحصري (المعلم)',
    style: 'مرتل · تعليمي',
    country: 'مصر',
    serverKey: 'Husary_128kbps',
    quranComRecitationId: 6,
  },
  {
    id: 'minshawi',
    name: 'محمد صديق المنشاوي',
    style: 'مرتل',
    country: 'مصر',
    serverKey: 'Minshawy_Murattal_128kbps',
    quranComRecitationId: 9,
  },
  {
    id: 'abdulbasit',
    name: 'عبد الباسط عبد الصمد',
    style: 'مرتل',
    country: 'مصر',
    serverKey: 'Abdul_Basit_Murattal_192kbps',
    quranComRecitationId: 2,
  },
  {
    id: 'sudais',
    name: 'عبد الرحمن السديس',
    style: 'مرتل',
    country: 'السعودية',
    serverKey: 'Abdurrahmaan_As-Sudais_192kbps',
    quranComRecitationId: 3,
  },
  {
    id: 'shuraim',
    name: 'سعود الشريم',
    style: 'مرتل',
    country: 'السعودية',
    serverKey: 'Saood_ash-Shuraym_128kbps',
    quranComRecitationId: 10,
  },
  {
    id: 'ghamdi',
    name: 'سعد الغامدي',
    style: 'مرتل',
    country: 'السعودية',
    serverKey: 'Ghamadi_40kbps',
  },
  {
    id: 'ajamy',
    name: 'أحمد بن علي العجمي',
    style: 'مرتل',
    country: 'السعودية',
    serverKey: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net',
  },
  {
    id: 'maher',
    name: 'ماهر المعيقلي',
    style: 'مرتل',
    country: 'السعودية',
    serverKey: 'MaherAlMuaiqly128kbps',
  },
];

export function getAyahAudioUrl(
  serverKey: string,
  surahNumber: number,
  ayahNumber: number
): string {
  const s = String(Math.max(1, Math.min(114, Math.floor(surahNumber)))).padStart(3, '0');
  const a = String(Math.max(1, Math.floor(ayahNumber))).padStart(3, '0');
  return `https://everyayah.com/data/${serverKey}/${s}${a}.mp3`;
}
