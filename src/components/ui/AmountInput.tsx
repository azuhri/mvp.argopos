import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface AmountInputProps {
  value?: number;
  onChange?: (value: number) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  min?: number;
  max?: number;
}

// Indonesian Rupiah formatter
const formatRupiah = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Parse Indonesian Rupiah string to number
const parseRupiah = (str: string): number => {
  // Remove all non-numeric characters except decimal point
  const cleanStr = str.replace(/[^\d.,]/g, '');
  
  // Replace comma with dot for decimal parsing
  const normalizedStr = cleanStr.replace(/\./g, '').replace(/,/g, '.');
  
  const parsed = parseFloat(normalizedStr);
  return isNaN(parsed) ? 0 : parsed;
};

// Format number for display (with thousand separators but no currency symbol)
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('id-ID').format(value);
};

export const AmountInput: React.FC<AmountInputProps> = ({
  value = 0,
  onChange,
  placeholder = '0',
  label,
  disabled = false,
  required = false,
  className,
  id,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
}) => {
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update display value when value prop changes
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value.toString());
    }
  }, [value, isFocused]);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty input or numbers only
    if (inputValue === '') {
      setDisplayValue('');
      onChange?.(0);
      return;
    }

    // Parse the input value
    const parsedValue = parseRupiah(inputValue);
    
    // Apply min/max constraints
    const constrainedValue = Math.max(min, Math.min(max, parsedValue));
    
    // Update display with formatted value if not focused
    if (!isFocused) {
      setDisplayValue(formatRupiah(constrainedValue));
    } else {
      // Keep raw input while focused for better UX
      setDisplayValue(inputValue);
    }
    
    onChange?.(constrainedValue);
  }, [onChange, min, max, isFocused]);

  // Handle focus
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Show raw number when focused
    setDisplayValue(value.toString());
    e.target.select();
  }, [value]);

  // Handle blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    // Format as rupiah when unfocused
    setDisplayValue(formatRupiah(value));
  }, [value]);

  // Handle key press for validation
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, numbers, decimal point, comma
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      '.', ',', 'ArrowLeft', 'ArrowRight', 'Home', 'End'
    ];

    if (!allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  }, []);

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const parsedValue = parseRupiah(pastedText);
    
    if (!isNaN(parsedValue)) {
      const constrainedValue = Math.max(min, Math.min(max, parsedValue));
      setDisplayValue(formatRupiah(constrainedValue));
      onChange?.(constrainedValue);
    }
  }, [onChange, min, max]);

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label htmlFor={id} className={cn(required && 'after:content:["*"] after:ml-1 after:text-red-500')}>
          {label}
        </Label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-muted-foreground text-sm">Rp</span>
        </div>
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyPress={handleKeyPress}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pl-8',
            isFocused && 'ring-2 ring-primary ring-offset-2',
            'font-mono' // Use monospace for better number alignment
          )}
          inputMode="numeric"
          pattern="[0-9.,]*"
        />
      </div>
      {value > 0 && (
        <p className="text-xs text-muted-foreground">
          Nilai: {formatRupiah(value)}
        </p>
      )}
    </div>
  );
};

// Additional helper component for displaying formatted amounts
export const FormattedAmount: React.FC<{
  value: number;
  className?: string;
  showCurrency?: boolean;
}> = ({ value, className, showCurrency = true }) => {
  const formatted = showCurrency ? formatRupiah(value) : formatNumber(value);
  
  return (
    <span className={cn('font-mono', className)}>
      {formatted}
    </span>
  );
};

export default AmountInput;
