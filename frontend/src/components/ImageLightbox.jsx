import { useState, useEffect } from "react";
import { X, ZoomIn, ZoomOut, Download, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const ImageLightbox = ({ src, alt = "Photo preview", onClose }) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        onClick={onClose}
      >
        {/* Floating toolbar */}
        <div
          className="absolute top-4 right-4 flex items-center gap-2 bg-base-100/30 backdrop-blur-md p-2 rounded-2xl border border-white/10 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleZoomIn}
            className="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20"
            title="Zoom In"
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20"
            title="Zoom Out"
          >
            <ZoomOut className="size-4" />
          </button>
          <button
            onClick={handleRotate}
            className="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20"
            title="Rotate"
          >
            <RotateCw className="size-4" />
          </button>
          <a
            href={src}
            download="chat-photo"
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20"
            title="Download"
          >
            <Download className="size-4" />
          </a>
          <button
            onClick={onClose}
            className="btn btn-sm btn-circle btn-ghost text-white hover:bg-white/20"
            title="Close (Esc)"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Image Display */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="max-w-[90vw] max-h-[85vh] overflow-hidden rounded-2xl flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={src}
            alt={alt}
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transition: "transform 0.2s ease-out",
            }}
            className="max-w-full max-h-[85vh] object-contain rounded-xl select-none shadow-2xl"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageLightbox;
