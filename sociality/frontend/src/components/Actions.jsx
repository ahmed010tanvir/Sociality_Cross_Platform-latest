import {
	Box,
	Button,
	Flex,
	FormControl,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Text,
	useDisclosure,
	Avatar,
	Textarea,
	Image,
	CloseButton,
	IconButton,
	useToast,
} from "@chakra-ui/react";
import { useState, useRef, useCallback, memo } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import { userAtom, postsAtom } from "../atoms";

import { BsFillImageFill } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import { Heart, ChatCircle, ArrowsClockwise, PaperPlaneTilt } from "phosphor-react";
import { fetchWithSession } from "../utils/api";

// Simple debounce function to prevent multiple rapid clicks
const useDebounce = (callback, delay = 300) => {
  const timeoutRef = useRef(null);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

// Memoize the Actions component to prevent unnecessary re-renders
const Actions = memo(({ post }) => {
	const user = useRecoilValue(userAtom);
	const [liked, setLiked] = useState(post.likes.includes(user?._id));
	const [posts, setPosts] = useRecoilState(postsAtom);
	const [isLiking, setIsLiking] = useState(false);
	// Add state for repost
	const [reposted, setReposted] = useState(post.reposts.includes(user?._id));
	const [isReposting, setIsReposting] = useState(false);
	// ---
	const [isReplying, setIsReplying] = useState(false);
	const [reply, setReply] = useState("");
	const [image, setImage] = useState(null);
	const [imagePreview, setImagePreview] = useState(null);
	const imageRef = useRef(null);

	const toast = useToast();
	const navigate = useNavigate();
	const { isOpen, onOpen, onClose } = useDisclosure();

	// Define base handlers without debounce
	const handleLikeAndUnlikeBase = useCallback(async () => {
		if (!user) {
			toast({
				title: "Error",
				description: "You must be logged in to like a post",
				status: "error",
				duration: 3000,
				isClosable: true
			});
			return;
		}
		if (isLiking) return;
		setIsLiking(true);
		try {
			const res = await fetchWithSession("/api/posts/like/" + post._id, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
			});
			const data = await res.json();
			if (data.error) {
				toast({
					title: "Error",
					description: data.error,
					status: "error",
					duration: 3000,
					isClosable: true
				});
				return;
			}

			if (!liked) {
				// add the id of the current user to post.likes array
				const updatedPosts = posts.map((p) => {
					if (p._id === post._id) {
						return { ...p, likes: [...p.likes, user._id] };
					}
					return p;
				});
				setPosts(updatedPosts);
			} else {
				// remove the id of the current user from post.likes array
				const updatedPosts = posts.map((p) => {
					if (p._id === post._id) {
						return { ...p, likes: p.likes.filter((id) => id !== user._id) };
					}
					return p;
				});
				setPosts(updatedPosts);
			}

			setLiked(!liked);
		} catch (error) {
			toast({
				title: "Error",
				description: error.message,
				status: "error",
				duration: 3000,
				isClosable: true
			});
		} finally {
			setIsLiking(false);
		}
	}, [user, isLiking, post._id, liked, posts, setPosts, toast]);

	// Apply debounce to the like handler
	const handleLikeAndUnlike = useDebounce(handleLikeAndUnlikeBase, 300);

	const handleImageChange = useCallback((e) => {
		const file = e.target.files[0];
		if (file) {
			// Optimize image before setting it
			const reader = new FileReader();
			reader.onload = (event) => {
				const img = new Image();
				img.onload = () => {
					// Create a URL for the optimized image
					setImagePreview(event.target.result);
					setImage(file);
				};
				img.src = event.target.result;
			};
			reader.readAsDataURL(file);
		}
	}, []);

	const handleReplyBase = useCallback(async () => {
		if (!user) {
			toast({
				title: "Error",
				description: "You must be logged in to reply to a post",
				status: "error",
				duration: 3000,
				isClosable: true
			});
			return;
		}
		if (isReplying) return;

		if (!reply.trim() && !image) {
			toast({
				title: "Error",
				description: "Reply cannot be empty",
				status: "error",
				duration: 3000,
				isClosable: true
			});
			return;
		}

		setIsReplying(true);
		try {
			// Convert image to base64 if it exists
			let imgUrl = null;
			if (image) {
				const reader = new FileReader();
				const imgPromise = new Promise((resolve) => {
					reader.onload = (e) => resolve(e.target.result);
					reader.readAsDataURL(image);
				});
				imgUrl = await imgPromise;
			}

			console.log("Sending reply to server...");
			const res = await fetchWithSession("/api/posts/reply/" + post._id, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: reply,
					img: imgUrl
				}),
			});
			const data = await res.json();
			console.log("Server response:", data);

			if (data.error) {
				console.error("Error from server:", data.error);
				toast({
					title: "Error",
					description: data.error,
					status: "error",
					duration: 3000,
					isClosable: true
				});
				return;
			}

			// Optimistically update the UI
			console.log("Updating UI with new reply");
			const updatedPosts = posts.map((p) => {
				if (p._id === post._id) {
					console.log("Adding reply to post:", p._id);
					return { ...p, replies: [...p.replies, data] };
				}
				return p;
			});
			setPosts(updatedPosts);
			console.log("UI updated with new reply");

			// Create a custom toast with a View button
			toast({
				title: "Success",
				description: "Reply posted",
				status: "success",
				duration: 5000,
				isClosable: true,
				position: "bottom",
				render: ({ onClose }) => (
					<Box
						color="white"
						p={3}
						bg="green.500"
						borderRadius="md"
						boxShadow="md"
					>
						<Flex justifyContent="space-between" alignItems="center">
							<Text fontWeight="bold">Reply posted</Text>
							<Button
								size="sm"
								colorScheme="whiteAlpha"
								onClick={() => {
									onClose();
									// Navigate to post with the new reply ID as a query parameter
									// This will temporarily highlight the reply at the top
									navigate(`/${post.postedBy.username}/post/${post._id}?highlight=${data._id}`);
								}}
								ml={3}
							>
								View
							</Button>
						</Flex>
					</Box>
				)
			});

			// Close the modal and reset the form
			onClose();
			setReply("");
			setImage(null);
			setImagePreview(null);
		} catch (error) {
			toast({
				title: "Error",
				description: error.message,
				status: "error",
				duration: 3000,
				isClosable: true
			});
		} finally {
			setIsReplying(false);
		}
	}, [user, isReplying, reply, image, post._id, post.postedBy.username, posts, setPosts, toast, navigate, onClose]);

	// Apply debounce to the reply handler
	const handleReply = useDebounce(handleReplyBase, 300);

	// --- Handle Repost ---
	const handleRepostBase = useCallback(async () => {
		if (!user) {
			toast({
				title: "Error",
				description: "You must be logged in to repost",
				status: "error",
				duration: 3000,
				isClosable: true
			});
			return;
		}
		if (isReposting) return;
		setIsReposting(true);

		// Optimistically update UI first for better responsiveness
		const optimisticUpdatedPosts = posts.map((p) => {
			if (p._id === post._id) {
				if (reposted) {
					// Remove user ID from reposts
					return { ...p, reposts: p.reposts.filter((id) => id !== user._id) };
				} else {
					// Add user ID to reposts
					return { ...p, reposts: [...p.reposts, user._id] };
				}
			}
			return p;
		});
		setPosts(optimisticUpdatedPosts);
		setReposted(!reposted);

		try {
			const res = await fetchWithSession("/api/posts/repost/" + post._id, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			const data = await res.json();
			if (data.error) {
				// Revert optimistic update if there's an error
				setPosts(posts);
				setReposted(reposted);

				toast({
					title: "Error",
					description: data.error,
					status: "error",
					duration: 3000,
					isClosable: true
				});
				return;
			}

			toast({
				title: "Success",
				description: !reposted ? "Post reposted" : "Post un-reposted",
				status: "success",
				duration: 3000,
				isClosable: true
			});

		} catch (error) {
			// Revert optimistic update if there's an error
			setPosts(posts);
			setReposted(reposted);

			toast({
				title: "Error",
				description: error.message,
				status: "error",
				duration: 3000,
				isClosable: true
			});
		} finally {
			setIsReposting(false);
		}
	}, [user, isReposting, post._id, reposted, posts, setPosts, toast]);

	// Apply debounce to the repost handler
	const handleRepost = useDebounce(handleRepostBase, 300);
	// ---

	// --- Handle Share ---
	const handleShareBase = useCallback(async () => {
		// Use post.postedBy.username now that it's populated from the backend
		const postUrl = `${window.location.origin}/${post.postedBy.username}/post/${post._id}`;
		try {
			if (navigator.share) {
				await navigator.share({
					title: 'Check out this post!',
					text: post.text?.substring(0, 100) + "...", // Optional: share some text
					url: postUrl,
				});
				toast({
					title: "Success",
					description: "Post shared successfully",
					status: "success",
					duration: 3000,
					isClosable: true
				});
			} else {
				// Fallback: Copy link to clipboard
				await navigator.clipboard.writeText(postUrl);
				toast({
					title: "Success",
					description: "Post link copied to clipboard",
					status: "success",
					duration: 3000,
					isClosable: true
				});
			}
		} catch (error) {
			// Handle errors, e.g., user cancelled share, clipboard access denied
			if (error.name !== 'AbortError') { // Don't show error if user cancels share dialog
				toast({
					title: "Error",
					description: "Could not share post: " + error.message,
					status: "error",
					duration: 3000,
					isClosable: true
				});
			}
		}
	}, [post._id, post.postedBy.username, post.text, toast]);

	// Apply debounce to the share handler
	const handleShare = useDebounce(handleShareBase, 300);
	// ---


	return (
		// Removed outer Flex with flexDirection="column"
		<Flex gap={4} my={2} onClick={(e) => e.preventDefault()} className="post-action"> {/* Increased gap between action groups */}
			{/* Like Button & Count */}
			<Flex alignItems="center" gap={1}>
				<Box
					className="clean-icon"
					onClick={handleLikeAndUnlike}
				>
					<Heart
						size={24}
						weight={liked ? "fill" : "regular"}
						color={liked ? "#ff3b5c" : "#616161"}
					/>
				</Box>
				{post.likes.length > 0 && (
					<Text color={"gray.light"} fontSize='sm'>
						{post.likes.length}
					</Text>
				)}
			</Flex>

			{/* Comment Button & Count */}
			<Flex alignItems="center" gap={1}>
				<Box
					className="clean-icon"
					onClick={onOpen}
					data-testid="reply-button"
				>
					<ChatCircle
						size={24}
						weight="regular"
						color="#616161"
					/>
				</Box>
				{post.replies.length > 0 && (
					<Text color={"gray.light"} fontSize='sm'>
						{post.replies.length}
					</Text>
				)}
			</Flex>

			{/* Repost Button & Count */}
			<Flex alignItems="center" gap={1}>
				<Box
					className="clean-icon"
					cursor={isReposting ? "not-allowed" : "pointer"}
					onClick={handleRepost}
				>
					<ArrowsClockwise
						size={24}
						weight={reposted ? "fill" : "regular"}
						color={reposted ? "#00CC85" : "#616161"}
					/>
				</Box>
				{post.reposts.length > 0 && (
					<Text color={"gray.light"} fontSize='sm'>
						{post.reposts.length}
					</Text>
				)}
			</Flex>

			{/* Share Button */}
			<Flex alignItems="center" gap={1}>
				<Box
					className="clean-icon"
					onClick={handleShare}
				>
					<PaperPlaneTilt
						size={24}
						weight="regular"
						color="#616161"
					/>
				</Box>
				{/* Share count is usually not displayed directly */}
			</Flex>

			{/* Reply Modal with #101010 theme */}
			<Modal isOpen={isOpen} onClose={onClose}>
				<ModalOverlay />
				<ModalContent
					bg="#101010"
					color="white"
					borderColor="rgba(0, 204, 133, 0.3)"
					borderWidth="1px"
					borderRadius="md"
					boxShadow="0 0 0 1px rgba(0, 204, 133, 0.2), 0 4px 6px -1px rgba(0, 0, 0, 0.1)"
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
					<ModalHeader>Reply to Post</ModalHeader>
					<ModalCloseButton color="gray.400" />
					<ModalBody pb={6}>
						<Flex gap={4}>
							{/* User Avatar */}
							<Avatar
								size="md"
								src={user?.profilePic}
								name={user?.username}
							/>

							<Flex direction="column" flex={1}>
								<FormControl>
									<Textarea
										placeholder="Write your reply..."
										value={reply}
										onChange={(e) => setReply(e.target.value)}
										bg="transparent"
										border="none"
										_focus={{ border: "none", boxShadow: "none" }}
										color="white"
										fontSize="md"
										minH="100px"
										resize="none"
									/>
								</FormControl>

								{/* Image Preview */}
								{imagePreview && (
									<Box
										mt={2}
										mb={4}
										position={"relative"}
										borderRadius="lg"
										overflow="hidden"
										borderWidth="1px"
										borderColor="gray.700"
									>
										<Image
											src={imagePreview}
											alt='Selected img'
											maxH="200px"
											objectFit="cover"
											w="full"
										/>
										<CloseButton
											onClick={() => {
												setImage(null);
												setImagePreview(null);
											}}
											bg={"rgba(0,0,0,0.7)"}
											color="white"
											position={"absolute"}
											top={2}
											right={2}
											size="sm"
											borderRadius="full"
										/>
									</Box>
								)}

								{/* Add Image Button */}
								<Flex justify="flex-start" mt={2}>
									<Input type='file' hidden ref={imageRef} onChange={handleImageChange} />
									<IconButton
										aria-label="Add image"
										icon={<BsFillImageFill />}
										onClick={() => imageRef.current.click()}
										variant="ghost"
										colorScheme="gray"
										size="md"
										borderRadius="full"
									/>
								</Flex>
							</Flex>
						</Flex>
					</ModalBody>

					<ModalFooter>
						<Button
							bg="white"
							color="black"
							_hover={{ bg: "gray.200", transform: "translateY(-2px)" }}
							borderRadius="md"
							px={6}
							py={2}
							fontWeight="bold"
							size="sm"
							isLoading={isReplying}
							onClick={handleReply}
							boxShadow="md"
							transition="all 0.2s"
						>
							Reply
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</Flex> // This Flex now wraps all action groups
	);
});

Actions.displayName = 'Actions';

export default Actions;

// Removed the custom SVG components as we are using react-icons now.
// If you prefer the custom SVGs, you can keep them and adjust the code above accordingly.
