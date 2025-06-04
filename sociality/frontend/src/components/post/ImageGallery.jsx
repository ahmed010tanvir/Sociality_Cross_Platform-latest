import { useState, useEffect, useCallback, memo } from "react";
import { Box, Image, HStack, Circle, IconButton, Modal, ModalOverlay, ModalContent, ModalBody } from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon, ArrowBackIcon } from "@chakra-ui/icons";

/**
 * Image gallery component for posts
 * Displays images with navigation controls and full-screen view
 */
const ImageGallery = memo(({ images }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  // Handle back button for image modal
  useEffect(() => {
    const handleBackButton = () => {
      if (isImageModalOpen) {
        setIsImageModalOpen(false);
      }
    };

    // Listen for popstate event (back button)
    window.addEventListener('popstate', handleBackButton);

    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [isImageModalOpen]);

  // Memoize navigation handlers
  const handlePrevImage = useCallback((e) => {
    if (e) e.stopPropagation();
    setCurrentImageIndex(prev => prev - 1);
  }, []);

  const handleNextImage = useCallback((e) => {
    if (e) e.stopPropagation();
    setCurrentImageIndex(prev => prev + 1);
  }, []);

  const handleOpenModal = useCallback((e) => {
    e.stopPropagation();
    // Push a new history state before opening the modal
    window.history.pushState({ modal: 'image' }, '');
    setIsImageModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsImageModalOpen(false);
  }, []);

  // Debug the images array
  console.log("ImageGallery received images:", images);

  // No images to display
  if (!images || !Array.isArray(images) || images.length === 0) {
    return null;
  }

  // Validate all images are valid URLs
  const validImages = images.filter(img =>
    typeof img === 'string' &&
    (img.startsWith('http://') || img.startsWith('https://'))
  );

  if (validImages.length === 0) {
    console.error("No valid images found in:", images);
    return null;
  }

  return (
    <>
      <Box
        borderRadius="xl"
        overflow="hidden"
        mt={2}
        position="relative"
        cursor="pointer"
        onClick={handleOpenModal}
        className="image-container threads-post-card" // Apply optimized CSS and our custom class
      >
        {/* Main image */}
        <Image
          src={validImages[currentImageIndex]}
          w="full"
          maxH="500px"
          objectFit="cover"
          loading="lazy" // Add lazy loading for better performance
          decoding="async" // Use async decoding for better performance
          className="post-image" // Apply optimized CSS
          fallbackSrc="https://via.placeholder.com/500x300?text=Loading+Image"
          onError={(e) => {
            console.error("Image failed to load:", validImages[currentImageIndex]);
            e.target.src = "https://via.placeholder.com/500x300?text=Image+Error";
          }}
        />

        {/* Navigation arrows for multiple images */}
        {validImages.length > 1 && (
          <>
            {/* Left arrow */}
            {currentImageIndex > 0 && (
              <IconButton
                icon={<ChevronLeftIcon boxSize={6} />}
                aria-label="Previous image"
                position="absolute"
                left={2}
                top="50%"
                transform="translateY(-50%)"
                borderRadius="full"
                bg="rgba(0,0,0,0.7)"
                color="white"
                _hover={{ bg: "rgba(0,0,0,0.8)" }}
                onClick={handlePrevImage}
                size="sm"
              />
            )}

            {/* Right arrow */}
            {currentImageIndex < validImages.length - 1 && (
              <IconButton
                icon={<ChevronRightIcon boxSize={6} />}
                aria-label="Next image"
                position="absolute"
                right={2}
                top="50%"
                transform="translateY(-50%)"
                borderRadius="full"
                bg="rgba(0,0,0,0.7)"
                color="white"
                _hover={{ bg: "rgba(0,0,0,0.8)" }}
                onClick={handleNextImage}
                size="sm"
              />
            )}
          </>
        )}

        {/* Image indicators */}
        {validImages.length > 1 && (
          <HStack
            spacing={1}
            position="absolute"
            bottom={2}
            left="50%"
            transform="translateX(-50%)"
            justify="center"
          >
            {validImages.map((_, index) => (
              <Circle
                key={index}
                size={2}
                bg={index === currentImageIndex ? "white" : "rgba(255,255,255,0.5)"}
                cursor="pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex(index);
                }}
              />
            ))}
          </HStack>
        )}

        {/* Image counter */}
        {validImages.length > 1 && (
          <Box
            position="absolute"
            top={2}
            left={2}
            bg="rgba(0,0,0,0.7)"
            color="white"
            fontSize="xs"
            fontWeight="bold"
            px={2}
            py={1}
            borderRadius="md"
          >
            {currentImageIndex + 1}/{validImages.length}
          </Box>
        )}
      </Box>

      {/* Full-size image modal */}
      <Modal
        isOpen={isImageModalOpen}
        onClose={handleCloseModal}
        size="full"
        isCentered
        returnFocusOnClose={false}
        blockScrollOnMount={false}
      >
        <ModalOverlay bg="blackAlpha.900" backdropFilter="blur(10px)" />
        <ModalContent bg="transparent" boxShadow="none" maxW="100vw" maxH="100vh">
          {/* Back button */}
          <IconButton
            icon={<ArrowBackIcon boxSize={6} />}
            aria-label="Back to previous page"
            position="absolute"
            top={4}
            left={4}
            zIndex={10}
            variant="ghost"
            color="white"
            _hover={{ color: "rgba(0, 204, 133, 0.9)" }}
            onClick={handleCloseModal}
            size="md"
          />
          <ModalBody
            display="flex"
            alignItems="center"
            justifyContent="center"
            p={0}
            position="relative"
          >
            <Box position="relative">
              <Image
                src={validImages[currentImageIndex]}
                maxH="90vh"
                maxW="90vw"
                objectFit="contain"
                loading="lazy" // Add lazy loading for better performance
                decoding="async" // Use async decoding for better performance
                className="modal-content" // Apply optimized CSS
                fallbackSrc="https://via.placeholder.com/800x600?text=Loading+Image"
                onError={(e) => {
                  console.error("Modal image failed to load:", validImages[currentImageIndex]);
                  e.target.src = "https://via.placeholder.com/800x600?text=Image+Error";
                }}
              />

              {/* Image counter in modal */}
              {validImages.length > 1 && (
                <Box
                  position="absolute"
                  top={4}
                  left={16} // Moved to the right to avoid overlapping with back button
                  bg="rgba(0,0,0,0.7)"
                  color="white"
                  fontSize="md"
                  fontWeight="bold"
                  px={3}
                  py={1}
                  borderRadius="md"
                >
                  {currentImageIndex + 1}/{validImages.length}
                </Box>
              )}
            </Box>

            {/* Navigation arrows for multiple images in modal */}
            {validImages.length > 1 && (
              <>
                {/* Left arrow */}
                {currentImageIndex > 0 && (
                  <IconButton
                    icon={<ChevronLeftIcon boxSize={8} />}
                    aria-label="Previous image"
                    position="absolute"
                    left={5}
                    top="50%"
                    transform="translateY(-50%)"
                    borderRadius="full"
                    bg="rgba(0,0,0,0.7)"
                    color="white"
                    _hover={{ bg: "rgba(0,0,0,0.8)" }}
                    onClick={handlePrevImage}
                    size="lg"
                  />
                )}

                {/* Right arrow */}
                {currentImageIndex < validImages.length - 1 && (
                  <IconButton
                    icon={<ChevronRightIcon boxSize={8} />}
                    aria-label="Next image"
                    position="absolute"
                    right={5}
                    top="50%"
                    transform="translateY(-50%)"
                    borderRadius="full"
                    bg="rgba(0,0,0,0.7)"
                    color="white"
                    _hover={{ bg: "rgba(0,0,0,0.8)" }}
                    onClick={handleNextImage}
                    size="lg"
                  />
                )}
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
});

ImageGallery.displayName = 'ImageGallery';

export default ImageGallery;
