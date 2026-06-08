import { useState, useRef } from "react";
import { Camera, Upload, X, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PickupProofUploadProps {
  transactionId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PickupProofUpload({
  transactionId,
  onSuccess,
  onCancel
}: PickupProofUploadProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select an image first');
      return;
    }

    setIsUploading(true);

    try {
      // Use file upload (follows Products.tsx pattern)
      const response = await apiClient.uploadPickupProof(transactionId, selectedFile);
      if (response.success) {
        toast.success('Pickup proof uploaded successfully');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload pickup proof');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-semibold text-lg">Upload Bukti Serah Terima</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Ambil foto atau upload bukti serah terima barang
        </p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
        id="pickup-proof-input"
      />

      {!imagePreview ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Klik untuk mengambil foto</p>
              <p className="text-sm text-muted-foreground mt-1">
                atau drag & drop gambar di sini
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Format: JPG, PNG, WEBP (Max: 5MB)
            </p>
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img
            src={imagePreview}
            alt="Pickup proof preview"
            className="w-full h-auto max-h-64 object-contain bg-black/5"
          />
          <button
            onClick={handleRemoveImage}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={isUploading}
          >
            Batal
          </Button>
        )}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="flex-1"
        >
          {isUploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
              Mengupload...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Bukti
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Modal wrapper for pickup proof upload
interface PickupProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  transactionCode: string;
  onSuccess?: () => void;
}

export function PickupProofModal({
  isOpen,
  onClose,
  transactionId,
  transactionCode,
  onSuccess
}: PickupProofModalProps) {
  if (!isOpen) return null;

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Bukti Serah Terima</h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Transaksi: <span className="font-mono font-medium">{transactionCode}</span>
        </p>

        <PickupProofUpload
          transactionId={transactionId}
          onSuccess={handleSuccess}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
