/**
 * PersonSelectionModal Component
 * 
 * Displays an image with detected people labeled and allows user to select
 * which person they want to use for virtual try-on.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, User } from 'lucide-react';
import { usePersonDetection, type PersonDetection } from './PersonDetector';
import { cn } from '@/lib/utils';

interface PersonSelectionModalProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onPersonSelected: (personIndex: number, bbox: [number, number, number, number]) => void;
}

export const PersonSelectionModal: React.FC<PersonSelectionModalProps> = ({
  imageUrl,
  isOpen,
  onClose,
  onPersonSelected,
}) => {
  // Only run detection when modal is open and imageUrl is provided
  const { imageRef, isLoading, isProcessing, detectionResult, error } = usePersonDetection(
    isOpen && imageUrl ? imageUrl : '',
    0.5 // Minimum confidence threshold
  );

  const [selectedPersonIndex, setSelectedPersonIndex] = useState<number | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update image dimensions when image loads
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    
    const updateDimensions = () => {
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
    };
    
    if (img.complete) {
      updateDimensions();
    } else {
      img.onload = updateDimensions;
    }
  }, [imageRef, imageUrl]);

  // Draw bounding boxes on canvas
  useEffect(() => {
    if (!canvasRef.current || !imageRef.current || !detectionResult || !detectionResult.people || !imageDimensions || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    const container = containerRef.current;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Calculate scaling to fit image within container while maintaining aspect ratio
    const imgAspectRatio = imageDimensions.width / imageDimensions.height;
    const containerAspectRatio = containerWidth / containerHeight;

    let displayWidth: number;
    let displayHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (imgAspectRatio > containerAspectRatio) {
      // Image is wider - fit to width
      displayWidth = containerWidth;
      displayHeight = containerWidth / imgAspectRatio;
      offsetY = (containerHeight - displayHeight) / 2;
    } else {
      // Image is taller - fit to height
      displayHeight = containerHeight;
      displayWidth = containerHeight * imgAspectRatio;
      offsetX = (containerWidth - displayWidth) / 2;
    }

    // Set canvas size to match displayed image size
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Calculate scale factors
    const scaleX = displayWidth / imageDimensions.width;
    const scaleY = displayHeight / imageDimensions.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding boxes and labels
    if (!detectionResult.people || detectionResult.people.length === 0) return;
    
    detectionResult.people.forEach((person, index) => {
      const [x, y, width, height] = person.bbox;
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Draw bounding box
      ctx.strokeStyle = selectedPersonIndex === index ? '#FF4F00' : '#10B981'; // Orange if selected, green otherwise
      ctx.lineWidth = 3;
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);

      // Draw label background
      const labelText = `Person ${index + 1}`;
      ctx.font = 'bold 16px Arial';
      ctx.textBaseline = 'top';
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;
      const textHeight = 20;

      ctx.fillStyle = selectedPersonIndex === index ? '#FF4F00' : '#10B981';
      ctx.fillRect(scaledX, scaledY - textHeight - 4, textWidth + 12, textHeight + 4);

      // Draw label text
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, scaledX + 6, scaledY - textHeight);
    });
  }, [detectionResult, selectedPersonIndex, imageDimensions, imageRef]);

  // Handle person click
  const handlePersonClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!detectionResult || !detectionResult.people || !imageDimensions || !containerRef.current || !imageRef.current) return;

    const container = containerRef.current;
    const img = imageRef.current;
    const rect = container.getBoundingClientRect();
    
    // Calculate how image is displayed in container
    const imgAspectRatio = imageDimensions.width / imageDimensions.height;
    const containerAspectRatio = rect.width / rect.height;

    let displayWidth: number;
    let displayHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (imgAspectRatio > containerAspectRatio) {
      displayWidth = rect.width;
      displayHeight = rect.width / imgAspectRatio;
      offsetY = (rect.height - displayHeight) / 2;
    } else {
      displayHeight = rect.height;
      displayWidth = rect.height * imgAspectRatio;
      offsetX = (rect.width - displayWidth) / 2;
    }

    // Get click position relative to container
    const clickX = event.clientX - rect.left - offsetX;
    const clickY = event.clientY - rect.top - offsetY;

    // Scale click coordinates to image coordinates
    const scaleX = imageDimensions.width / displayWidth;
    const scaleY = imageDimensions.height / displayHeight;

    const imageClickX = clickX * scaleX;
    const imageClickY = clickY * scaleY;

    // Find which person was clicked
    for (let i = 0; i < detectionResult.people.length; i++) {
      const [x, y, width, height] = detectionResult.people[i].bbox;
      if (
        imageClickX >= x &&
        imageClickX <= x + width &&
        imageClickY >= y &&
        imageClickY <= y + height
      ) {
        setSelectedPersonIndex(i);
        break;
      }
    }
  };

  // Auto-select if only one person detected
  useEffect(() => {
    if (detectionResult && detectionResult.people && detectionResult.people.length === 1 && selectedPersonIndex === null) {
      setSelectedPersonIndex(0);
    }
  }, [detectionResult, selectedPersonIndex]);

  // Handle confirm selection
  const handleConfirm = () => {
    if (!detectionResult || !detectionResult.people || detectionResult.people.length === 0) return;
    
    // If only one person, use index 0
    const personIndex = detectionResult.people.length === 1 ? 0 : selectedPersonIndex;
    
    if (personIndex === null || personIndex < 0 || personIndex >= detectionResult.people.length) return;

    const selectedPerson = detectionResult.people[personIndex];
    if (!selectedPerson) return;
    
    onPersonSelected(personIndex, selectedPerson.bbox);
    onClose();
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-6xl max-h-[90vh] m-4 bg-white rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">
            Select Person for Try-On
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading || isProcessing ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-slate-600">
                {isLoading ? 'Loading AI model...' : 'Detecting people...'}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            </div>
          ) : detectionResult && detectionResult.people && detectionResult.people.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <User className="w-12 h-12 text-slate-400" />
              <p className="text-slate-600 text-lg">No people detected in this image.</p>
              <p className="text-slate-500 text-sm">
                Please upload an image with at least one person visible.
              </p>
            </div>
          ) : detectionResult && detectionResult.people && detectionResult.people.length === 1 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-slate-600 text-lg">
                One person detected. Click "Continue" to proceed.
              </p>
              <div className="relative flex items-center justify-center" ref={containerRef}>
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Uploaded photo"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  style={{ display: 'block' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute pointer-events-none"
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '60vh',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              </div>
            </div>
          ) : detectionResult && detectionResult.people && detectionResult.people.length > 1 ? (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <p className="text-slate-700 font-medium mb-1">
                  {detectionResult.people.length} people detected
                </p>
                <p className="text-slate-500 text-sm">
                  Click on a person to select them for virtual try-on
                </p>
              </div>

              <div
                ref={containerRef}
                className="relative mx-auto cursor-pointer flex items-center justify-center"
                onClick={handlePersonClick}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Uploaded photo"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  style={{ display: 'block' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute pointer-events-none"
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '60vh',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              </div>

              {/* Person list */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                {detectionResult.people.map((person, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedPersonIndex(index)}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-left',
                      selectedPersonIndex === index
                        ? 'border-primary bg-primary/10'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border-2',
                          selectedPersonIndex === index
                            ? 'bg-primary border-primary'
                            : 'bg-slate-200 border-slate-300'
                        )}
                      />
                      <span className="font-medium text-slate-700">
                        Person {index + 1}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Confidence: {Math.round(person.score * 100)}%
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {detectionResult && detectionResult.people && detectionResult.people.length > 0 && (
          <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={detectionResult.people.length > 1 && selectedPersonIndex === null}
              className={cn(
                'px-6 py-2 rounded-lg font-medium transition-colors',
                detectionResult.people.length > 1 && selectedPersonIndex === null
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/90'
              )}
            >
              {detectionResult.people.length === 1
                ? 'Continue'
                : selectedPersonIndex !== null
                ? `Select Person ${selectedPersonIndex + 1}`
                : 'Select a Person'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

