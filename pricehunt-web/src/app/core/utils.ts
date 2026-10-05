import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const toIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** End date may equal the start date, but not precede it. */
export function endNotBeforeStart(startKey = 'fromDate'): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const start = control.parent?.get(startKey)?.value as Date | null;
    const end = control.value as Date | null;
    if (!start || !end) return null;
    return startOfDay(end) < startOfDay(start) ? { endBeforeStart: true } : null;
  };
}
