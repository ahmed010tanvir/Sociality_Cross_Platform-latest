import { useState, useEffect, useCallback } from "react";
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalCloseButton,
    ModalBody,
    Text,
    VStack,
    Avatar,
    HStack,
    Divider,
    Link,
    Spinner,
    Center,
    Flex,
    Button,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import useFollowUnfollow from "../hooks/useFollowUnfollow";
import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms";

// Separate component for each user item to properly use hooks
const UserItem = ({ user, index, totalUsers, currentUser, handleFollowToggle, onClose }) => {
    const { handleFollowUnfollow, following, updating } = useFollowUnfollow(user, handleFollowToggle);

    if (currentUser && user._id === currentUser._id) return null;

    return (
        <div key={user._id || index}>
            <HStack spacing={4} align="center" justify="space-between">
                <HStack spacing={4} align="center">
                    <Avatar
                        size="md"
                        name={user.username || 'User'}
                        src={user.profilePic}
                    />
                    <Flex direction="column">
                        <Link
                            as={RouterLink}
                            to={`/${user.username}`}
                            fontWeight="medium"
                            _hover={{ textDecoration: 'underline' }}
                            onClick={onClose}
                        >
                            {user.username || 'Unknown User'}
                        </Link>
                        {user.name && (
                            <Text fontSize="sm" color="gray.500">
                                {user.name}
                            </Text>
                        )}
                    </Flex>
                </HStack>

                {currentUser && currentUser._id !== user._id && (
                    <Button
                        size="sm"
                        colorScheme={following ? "gray" : "blue"}
                        onClick={handleFollowUnfollow}
                        isLoading={updating}
                        variant={following ? "outline" : "solid"}
                    >
                        {following ? "Unfollow" : "Follow"}
                    </Button>
                )}
            </HStack>
            {index < totalUsers - 1 && <Divider mt={2} />}
        </div>
    );
};

const FollowList = ({ isOpen, onClose, users, title, onUserUpdate }) => {
    // Check if users is an array and has items
    const hasUsers = Array.isArray(users) && users.length > 0;
    const [isLoading, setIsLoading] = useState(false);
    const currentUser = useRecoilValue(userAtom);

    // Function to handle follow/unfollow and update the list
    const handleFollowToggle = useCallback((updatedUser) => {
        if (onUserUpdate) {
            onUserUpdate(updatedUser);
        }
    }, [onUserUpdate]);

    // Add effect to simulate loading when modal opens
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            // Simulate loading delay
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
            <ModalOverlay />
            <ModalContent bg={"gray.dark"} color={"white"}>
                <ModalHeader>{title} List</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    {isLoading && (
                        <Center py={8}>
                            <Spinner size="xl" color="blue.500" />
                        </Center>
                    )}

                    {!isLoading && !hasUsers && (
                        <Text textAlign="center" py={4}>
                            No {title.toLowerCase()} found
                        </Text>
                    )}

                    {!isLoading && hasUsers && (
                        <VStack align="stretch" spacing={4}>
                            {users.map((user, index) => {
                                // Skip if this is the current user or if user is missing _id
                                if (!user || !user._id) {
                                    return null;
                                }

                                return (
                                    <UserItem
                                        key={user._id || index}
                                        user={user}
                                        index={index}
                                        totalUsers={users.length}
                                        currentUser={currentUser}
                                        handleFollowToggle={handleFollowToggle}
                                        onClose={onClose}
                                    />
                                );
                            })}
                        </VStack>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default FollowList;
