import React from "react";
import {Input} from "@/components/ui/input";
const IDR_REGEX = /^(0|[1-9]\d{0,2}(\.\d{3})*)(,\d{0,2})?$/;

export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  disabled = false,
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    // Hanya angka, titik (ribuan), dan koma (desimal)
    input = input.replace(/[^\d.,]/g, "");

    // Hapus semua koma kecuali yang pertama
    const commaParts = input.split(",");
    if (commaParts.length > 2) {
      input = `${commaParts[0]},${commaParts.slice(1).join("")}`;
    }

    // Pisahkan integer dan decimal
    const [integerPart = "", decimalPart] = input.split(",");

    // Hapus semua titik lalu format ulang ribuan
    const numericInteger = integerPart.replace(/\./g, "");

    const formattedInteger = numericInteger
      ? new Intl.NumberFormat("id-ID").format(Number(numericInteger))
      : "";

    const formattedValue =
      decimalPart !== undefined
        ? `${formattedInteger},${decimalPart}`
        : formattedInteger;

    onChange(formattedValue);
  };

  const isValid =
    value === "" ||
    IDR_REGEX.test(value);

  return (
    <div>
      <Input 
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="decimal"
      />

      {!isValid && (
        <small style={{ color: "red" }}>
          Format rupiah tidak valid
        </small>
      )}
    </div>
  );
}