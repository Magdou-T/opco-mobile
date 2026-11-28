/** Assemble des classes CSS en ignorant les valeurs fausses : cx('a', condition && 'b', undefined) donne « a b » ou « a ». */
export const cx = (...classes: Array<string | false | null | undefined>): string => classes.filter(Boolean).join(' ');
