import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle, RotateCcw, ShoppingCart, Bell } from 'lucide-react';

const VirtualTryOnModal = () => {
  const [step, setStep] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState(1);
  const [selectedSize, setSelectedSize] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const recentPhotos = [
    { id: 1, src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' },
    { id: 2, src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka' },
    { id: 3, src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
    { id: 4, src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Char' },
  ];

  const demoModels = [
    { id: 5, src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dave' },
    { id: 6, src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Eve' },
    { id: 7, src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Frank' },
    { id: 8, src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Grace' },
  ];

  const sizes = ['S', 'M', 'L', 'XL'];

  const handleGenerate = () => {
    setStep('generating');
    setProgress(0);
  };

  useEffect(() => {
    if (step === 'generating') {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setStep('complete');
            return 100;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [step]);

  const handleAddToCart = () => {
    if (!selectedSize) return;
    setToastMessage(`Added Adidas Floral Jersey (Size ${selectedSize}) to cart!`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const getButtonState = () => {
    if (step === 'idle') {
      return { text: 'Generate Try-On', icon: <RotateCcw size={16} />, disabled: false, action: handleGenerate };
    }
    if (step === 'generating') {
      return { text: `Generating... ${progress}%`, icon: null, disabled: true, action: () => {} };
    }
    if (step === 'complete') {
      if (!selectedSize) return { text: 'Select a Size', icon: null, disabled: true, action: () => {} };
      if (selectedSize === 'XL') {
        return { text: 'Notify Me', icon: <Bell size={16} />, disabled: false, action: () => alert('Subscribed!') };
      }
      return { text: 'Add to Cart', icon: <ShoppingCart size={16} />, disabled: false, action: handleAddToCart };
    }
    return { text: 'Generate', icon: null };
  };

  const btnState = getButtonState();

  return (
    <div className="min-h-screen bg-white font-sans">
      <div className="min-h-screen" />

      <div className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden relative flex flex-col h-[800px]">
        {showToast && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-fade-in-up">
            <CheckCircle className="text-green-400" />
            <span>{toastMessage}</span>
            <button
              onClick={() => setShowToast(false)}
              className="ml-4 text-gray-400 hover:text-white underline text-sm"
            >
              Close
            </button>
          </div>
        )}

        <div className="flex justify-between items-center px-8 py-4 border-b border-gray-100">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">
              NUSENSE <span className="font-normal text-gray-500 text-sm ml-2">Virtual Try-On</span>
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-lg">
            <div className="text-xs text-gray-500">YOU'RE TRYING ON</div>
            <img
              src="https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Tiro_19_Jersey_Black_DW9146_01_laydown.jpg"
              alt="Jersey"
              className="w-8 h-8 rounded object-cover"
            />
            <div>
              <div className="text-sm font-semibold text-gray-800">Adidas Floral Jersey</div>
              <div className="text-xs text-gray-500">Black / Red</div>
            </div>
          </div>

          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="text-gray-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/2 p-8 overflow-y-auto border-r border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <h2 className="font-semibold text-gray-800">Choose your photo</h2>
            </div>

            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6 flex flex-col items-center text-center">
              <h3 className="text-xs font-bold text-orange-800 mb-2 uppercase tracking-wide">For best results</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-600 mb-4">
                <span className="flex items-center gap-1">
                  <CheckCircle size={10} className="text-green-500" /> Front-facing pose
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle size={10} className="text-green-500" /> Area well lit
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle size={10} className="text-green-500" /> Good lighting
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle size={10} className="text-green-500" /> Plain background
                </span>
              </div>
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors w-full justify-center">
                <Upload size={16} /> Upload Photo
              </button>
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-semibold text-gray-700">Recent photos</label>
              </div>
              <div className="flex gap-4">
                {recentPhotos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo.id)}
                    className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${
                      selectedPhoto === photo.id
                        ? 'border-orange-500 ring-2 ring-orange-100 scale-110'
                        : 'border-transparent hover:border-gray-200'
                    }`}
                  >
                    <img src={photo.src} alt="User" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-8">
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Use a demo model</label>
              <div className="flex gap-4">
                {demoModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedPhoto(model.id)}
                    className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all ${
                      selectedPhoto === model.id
                        ? 'border-orange-500 ring-2 ring-orange-100 scale-110'
                        : 'border-transparent hover:border-gray-200'
                    }`}
                  >
                    <img src={model.src} alt="Model" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <div className="flex justify-center gap-2 mb-6">
                <span className="text-sm text-gray-500 mr-2 self-center">Size:</span>
                {sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`w-10 h-10 rounded border text-sm font-medium transition-colors ${
                      selectedSize === size
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button
                onClick={btnState.action}
                disabled={btnState.disabled}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-lg transition-all ${
                  btnState.disabled
                    ? 'bg-orange-300 cursor-not-allowed text-white'
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-orange-200'
                }`}
              >
                {btnState.icon}
                {btnState.text}
              </button>

              <p className="text-center text-[10px] text-gray-400 mt-3">
                Rendered for aesthetic purposes. Sizes not reflect actual dimensions.
              </p>
            </div>
          </div>

          <div className="w-1/2 bg-gray-50 p-8 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full border-2 border-gray-300 text-gray-400 flex items-center justify-center text-sm font-bold">
                2
              </div>
              <h2 className="font-semibold text-gray-400">Your Look</h2>
            </div>

            <div className="flex-1 rounded-2xl border-2 border-dashed border-gray-200 bg-white relative flex items-center justify-center overflow-hidden">
              {step === 'idle' && (
                <div className="text-center">
                  <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 animate-pulse"></div>
                  <p className="text-gray-400 text-sm">
                    Your result will appear here.
                    <br />
                    Select a photo to get started.
                  </p>
                </div>
              )}

              {step === 'generating' && (
                <div className="text-center w-full px-12">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#eee" strokeWidth="8" />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#FF5722"
                        strokeWidth="8"
                        strokeDasharray="283"
                        strokeDashoffset={283 - (283 * progress) / 100}
                        className="transition-all duration-75 ease-linear"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-bold text-orange-500">
                      {progress}%
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-800">Creating your try-on...</h3>
                  <p className="text-sm text-gray-500 mt-2">Analyzing lighting and fit...</p>
                </div>
              )}

              {step === 'complete' && (
                <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-yellow-50 to-white">
                  <div className="relative w-64 h-auto shadow-2xl rounded-lg mb-6 transform transition-all hover:scale-105 duration-500">
                    <img
                      src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                      className="w-full h-full object-cover opacity-50 absolute inset-0 rounded-lg"
                    />
                    <img
                      src="https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Tiro_19_Jersey_Black_DW9146_01_laydown.jpg"
                      className="w-full h-full object-cover relative z-10 mix-blend-multiply rounded-lg"
                    />

                    <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 -z-10"></div>
                  </div>

                  <div className="flex items-center gap-2 text-green-600 font-semibold mb-2">
                    <CheckCircle size={18} fill="currentColor" className="text-white" />
                    Try-on complete!
                  </div>
                  <p className="text-sm text-orange-500 font-medium animate-pulse">Select a size below</p>

                  <button
                    onClick={() => setStep('idle')}
                    className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Not perfect? Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-gray-100 px-8 py-4 h-[120px] flex flex-col justify-center">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Your try-on history</h4>
            <button className="text-xs text-orange-500 font-medium hover:underline">View all</button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {[1, 2, 3].map((item, idx) => (
              <div
                key={idx}
                className="flex-shrink-0 w-16 h-20 bg-gray-50 rounded border border-gray-100 flex flex-col items-center justify-center cursor-pointer hover:border-orange-200"
              >
                <img
                  src="https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/3bbecbdf584e40398446a8bf0117cf62_9366/Tiro_19_Jersey_Black_DW9146_01_laydown.jpg"
                  className="w-8 h-8 object-contain mb-1"
                />
                <span className="text-[10px] text-gray-400">{idx === 0 ? 'Today' : `${idx} weeks...`}</span>
              </div>
            ))}
            <div className="flex-shrink-0 w-16 h-20 border border-dashed border-gray-200 rounded flex items-center justify-center">
              <span className="text-gray-300 text-xs">+</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default VirtualTryOnModal;
