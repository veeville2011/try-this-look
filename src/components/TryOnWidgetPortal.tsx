import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import TryOnWidget from "./TryOnWidget";

interface TryOnWidgetPortalProps {
  /**
   * The ID of the DOM element where the widget should be rendered.
   * If not provided, will create a container with id "nusense-widget-portal-root"
   */
  containerId?: string;
  /**
   * Whether the widget is open/visible
   */
  isOpen?: boolean;
  /**
   * Callback when widget should be closed
   */
  onClose?: () => void;
  /**
   * Whether to create the container if it doesn't exist
   * @default true
   */
  createContainerIfNotExists?: boolean;
}

/**
 * TryOnWidgetPortal - Renders TryOnWidget outside the React root using portals
 * 
 * This component uses React portals to render the widget in a specific DOM container
 * outside of the main React app root. This is useful for embedding scenarios where
 * you need the widget to appear in a specific location on the page.
 * 
 * For Shopify integration, this component:
 * - Renders the widget outside the React root div using portals
 * - Listens for postMessage events from the parent window (Shopify store)
 * - Handles widget open/close via postMessage communication
 * 
 * @example
 * ```tsx
 * // Render in a specific container
 * <TryOnWidgetPortal containerId="my-widget-container" isOpen={true} />
 * 
 * // Render in default container (will be created if doesn't exist)
 * <TryOnWidgetPortal isOpen={true} />
 * ```
 */
export default function TryOnWidgetPortal({
  containerId = "nusense-widget-portal-root",
  isOpen: initialIsOpen = true,
  onClose,
  createContainerIfNotExists = true,
}: TryOnWidgetPortalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(initialIsOpen);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
    
    // Notify parent window (Shopify store) that widget is closed
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage(
          { type: "NUSENSE_CLOSE_WIDGET" },
          "*"
        );
      } catch (error) {
        console.warn("NUSENSE: Failed to send close message to parent:", error);
      }
    }
  }, [onClose]);

  useEffect(() => {
    setIsMounted(true);

    const findOrCreateContainer = () => {
      // Try to find existing container
      let targetContainer = document.getElementById(containerId);

      // Create container if it doesn't exist and creation is allowed
      if (!targetContainer && createContainerIfNotExists) {
        targetContainer = document.createElement("div");
        targetContainer.id = containerId;
        targetContainer.setAttribute("data-nusense-portal", "true");
        // Append to body by default, or you can append to a specific parent
        document.body.appendChild(targetContainer);
      }

      setContainer(targetContainer);
    };

    findOrCreateContainer();

    // Cleanup: remove container if we created it and component unmounts
    return () => {
      if (createContainerIfNotExists && container) {
        const portalContainer = document.getElementById(containerId);
        if (portalContainer?.getAttribute("data-nusense-portal") === "true") {
          portalContainer.remove();
        }
      }
    };
  }, [containerId, createContainerIfNotExists]);

  // Listen for postMessage events from parent window (Shopify store)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify message is from a trusted source (optional security check)
      // In production, you might want to verify event.origin
      
      if (event.data && typeof event.data === "object") {
        if (event.data.type === "NUSENSE_OPEN_WIDGET") {
          setIsOpen(true);
        } else if (event.data.type === "NUSENSE_CLOSE_WIDGET") {
          handleClose();
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [handleClose]);

  // Update isOpen state when prop changes
  useEffect(() => {
    setIsOpen(initialIsOpen);
  }, [initialIsOpen]);

  // Don't render until mounted (SSR safety)
  if (!isMounted || !container) {
    return null;
  }

  // Only render widget if isOpen is true
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="nusense-widget-portal-wrapper w-fit h-auto">
      <TryOnWidget isOpen={isOpen} onClose={handleClose} />
    </div>,
    container
  );
}

