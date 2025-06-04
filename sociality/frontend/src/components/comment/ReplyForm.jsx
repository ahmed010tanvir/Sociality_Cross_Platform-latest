import { useRef } from "react";
import { 
  Box, 
  Flex, 
  Avatar, 
  Textarea, 
  Button, 
  IconButton, 
  Image, 
  CloseButton 
} from "@chakra-ui/react";
import { BsFillImageFill } from "react-icons/bs";

/**
 * Reply form component
 * Form for replying to a comment
 */
const ReplyForm = ({ 
  currentUser, 
  username, 
  replyText, 
  setReplyText, 
  imagePreview, 
  setImagePreview, 
  replyImage, 
  setReplyImage, 
  isSubmitting, 
  onSubmit, 
  onClose 
}) => {
  const imageRef = useRef(null);

  // Handle image upload for reply
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setReplyImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <Box
      mt={3}
      bg="#101010"
      borderRadius="md"
      borderWidth="1px"
      borderColor="rgba(0, 204, 133, 0.3)"
      boxShadow="0 0 0 1px rgba(0, 204, 133, 0.2)"
      p={3}
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        top: "-1px",
        right: "-1px",
        bottom: "-1px",
        left: "-1px",
        borderRadius: "md",
        border: "1px solid rgba(0, 204, 133, 0.3)",
        pointerEvents: "none"
      }}
    >
      <Flex gap={3}>
        {/* User Avatar */}
        <Avatar
          size="sm"
          src={currentUser?.profilePic}
          name={currentUser?.username}
        />

        <Flex direction="column" flex={1}>
          {/* Text Input Area */}
          <Textarea
            placeholder={`Reply to ${username}...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            bg="transparent"
            border="none"
            _focus={{ border: "none", boxShadow: "none" }}
            color="white"
            fontSize="sm"
            minH="60px"
            resize="none"
            mb={2}
          />

          {/* Image Preview */}
          {imagePreview && (
            <Box
              mt={2}
              mb={3}
              position="relative"
              borderRadius="lg"
              overflow="hidden"
              borderWidth="1px"
              borderColor="gray.700"
            >
              <Image
                src={imagePreview}
                alt='Selected img'
                maxH="150px"
                objectFit="cover"
                w="full"
              />
              <CloseButton
                onClick={() => {
                  setReplyImage(null);
                  setImagePreview(null);
                }}
                bg="rgba(0,0,0,0.7)"
                color="white"
                position="absolute"
                top={2}
                right={2}
                size="sm"
                borderRadius="full"
              />
            </Box>
          )}

          {/* Action Buttons */}
          <Flex justify="space-between" align="center">
            <input
              type='file'
              hidden
              ref={imageRef}
              onChange={handleImageChange}
            />
            <IconButton
              aria-label="Add image"
              icon={<BsFillImageFill />}
              onClick={() => imageRef.current.click()}
              variant="ghost"
              colorScheme="gray"
              size="sm"
              borderRadius="full"
            />
            <Flex gap={2}>
              <Button
                variant="ghost"
                colorScheme="gray"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                bg="white"
                color="black"
                _hover={{ bg: "gray.200" }}
                borderRadius="md"
                size="sm"
                isLoading={isSubmitting}
                onClick={onSubmit}
                isDisabled={!replyText.trim() && !replyImage}
              >
                Reply
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
};

export default ReplyForm;
