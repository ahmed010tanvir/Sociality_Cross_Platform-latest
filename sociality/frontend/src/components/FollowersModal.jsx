import { useState, useEffect } from "react";
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
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms";
import FollowButton from "./FollowButton";

const FollowersModal = ({ isOpen, onClose, users, title }) => {
    const [isLoading, setIsLoading] = useState(true);
    const currentUser = useRecoilValue(userAtom);

    // Simulate loading
    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            const timer = setTimeout(() => {
                setIsLoading(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Handle follow/unfollow updates
    const handleFollowToggle = (isFollowing, userId) => {
        // If we're in the following list and unfollowing, remove the user from the list
        if (title === "Following" && !isFollowing) {
            // This would be handled by the parent component
            console.log(`User ${userId} unfollowed and should be removed from list`);
        }
    };

    // Check if users is an array and has items
    const hasUsers = Array.isArray(users) && users.length > 0;

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
                        <VStack align="stretch" spacing={4} pb={4}>
                            {users.map((user, index) => {
                                if (!user || !user.username) {
                                    return null;
                                }

                                // Check if current user is following this user
                                const isFollowing = currentUser?.following?.some(followingId => {
                                    const id = typeof followingId === 'string' ? followingId : followingId?._id;
                                    return id === user._id;
                                }) || false;

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
                                                <FollowButton
                                                    userId={user._id}
                                                    initialIsFollowing={isFollowing}
                                                    onFollowToggle={handleFollowToggle}
                                                />
                                            )}
                                        </HStack>
                                        {index < users.length - 1 && <Divider mt={2} />}
                                    </div>
                                );
                            })}
                        </VStack>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
};

export default FollowersModal;
