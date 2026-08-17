export const fmt = (n: number | null | undefined): string => '₹' + (n || 0).toLocaleString('en-IN');

export const todayYM = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const prevYM = (ym: string): string => {
  const d = new Date(ym + '-01');
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const MONTH_LABELS = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'];

export const mlabel = (ym: string): string => {
  if (!ym) return '';
  const [year, month] = ym.split('-');
  return `${MONTH_LABELS[+month - 1]} ${year}`;
};

export const payStatusLabel = (status: string): string => {
  if (status === 'full') return 'முழுமையாக';
  if (status === 'partial') return 'பகுதியாக';
  return 'இல்லை';
};
