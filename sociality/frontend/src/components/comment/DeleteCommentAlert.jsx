import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button
} from "@chakra-ui/react";

/**
 * Delete comment alert component
 * Confirmation dialog for deleting a comment
 */
const DeleteCommentAlert = ({ isOpen, onClose, onDelete, isDeleting, cancelRef }) => {
  return (
    <AlertDialog
      isOpen={isOpen}
      leastDestructiveRef={cancelRef}
      onClose={onClose}
    >
      <AlertDialogOverlay>
        <AlertDialogContent bg="#101010" borderColor="gray.700">
          <AlertDialogHeader fontSize="lg" fontWeight="bold" color="white">
            Delete Comment
          </AlertDialogHeader>

          <AlertDialogBody color="gray.300">
            Are you sure you want to delete this comment? This action cannot be undone.
          </AlertDialogBody>

          <AlertDialogFooter>
            <Button
              ref={cancelRef}
              onClick={onClose}
              variant="outline"
              borderColor="gray.600"
              color="gray.300"
              _hover={{ bg: "gray.700" }}
            >
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={onDelete}
              ml={3}
              isLoading={isDeleting}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
};

export default DeleteCommentAlert;
