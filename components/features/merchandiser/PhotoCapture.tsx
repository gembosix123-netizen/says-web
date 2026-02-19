'use client';

import React, { useRef } from 'react';
import { useMerchandiser } from '@/context/MerchandiserContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Camera, X, Image as ImageIcon } from 'lucide-react';

export function PhotoCapture() {
  const { photos, addPhoto, removePhoto, setStep } = useMerchandiser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          addPhoto(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCaptureClick = () => {
    fileInputRef.current?.click();
  };

  const handleContinue = () => {
    setStep(5); // Move to summary
  };

  const handleSkip = () => {
    if (confirm('Skip photo upload? You can upload photos later.')) {
      setStep(5); // Move to summary
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Upload Photos</h2>
        <p className="text-white/60">Take photos of the store and products (optional)</p>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <Card key={index} className="relative p-0 overflow-hidden group">
              <img
                src={photo}
                alt={`Photo ${index + 1}`}
                className="w-full h-48 object-cover"
              />
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                <X size={16} className="text-white" />
              </button>
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                Photo {index + 1}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {photos.length === 0 && (
        <Card className="py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 rounded-full bg-white/5 border border-white/10">
              <ImageIcon size={32} className="text-white/40" />
            </div>
            <div>
              <h3 className="text-white font-semibold mb-2">No Photos Yet</h3>
              <p className="text-white/60 text-sm">
                Tap the button below to start capturing photos
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Capture Button */}
      <Button
        onClick={handleCaptureClick}
        variant="secondary"
        size="lg"
        className="w-full"
      >
        <Camera className="mr-2" size={20} />
        {photos.length > 0 ? 'Add More Photos' : 'Capture Photos'}
      </Button>

      {/* Photo Count */}
      {photos.length > 0 && (
        <div className="text-center text-sm text-white/60">
          {photos.length} photo{photos.length !== 1 ? 's' : ''} captured
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSkip}
          variant="secondary"
          className="flex-1"
        >
          Skip Photos
        </Button>
        <Button
          onClick={handleContinue}
          variant="primary"
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
