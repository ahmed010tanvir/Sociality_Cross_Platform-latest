import { Avatar } from "@chakra-ui/avatar";
import { Image } from "@chakra-ui/image";
import { Box, Flex, Text, HStack, Circle } from "@chakra-ui/layout";
import { Link, useNavigate } from "react-router-dom";
import Actions from "./Actions";
import Comment from "./Comment";
import useShowToast from "../hooks/useShowToast";
import { formatDistanceToNow } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, ArrowBackIcon } from "@chakra-ui/icons";
import { useRecoilState, useRecoilValue } from "recoil";
import { userAtom, postsAtom } from "../atoms";
import {
	Button,
	Menu,
	MenuButton,
	MenuList,
	MenuItem,
	IconButton,
	Modal,
	ModalOverlay,
	ModalContent,
	ModalBody,
} from "@chakra-ui/react";

import { useState, useEffect } from "react";
import { fetchWithSession } from "../utils/api";

// Remove postedBy prop, rely on post.postedBy object
const Post = ({ post, showComments = false, isPostPage = false }) => {
	// Remove user state and useEffect
	const showToast = useShowToast();
	const currentUser = useRecoilValue(userAtom);
	const [posts, setPosts] = useRecoilState(postsAtom);
	const navigate = useNavigate();
	const [displayComments, setDisplayComments] = useState(showComments);

	// State for image gallery
	const [currentImageIndex, setCurrentImageIndex] = useState(0);
	const [isImageModalOpen, setIsImageModalOpen] = useState(false);

	// Check if post has multiple images (for future implementation)
	// For now, we'll just check if post.img exists and treat it as a single image
	const hasMultipleImages = post.images && Array.isArray(post.images) && post.images.length > 0;

	// Get images array - either from post.images or create an array with post.img
	const images = hasMultipleImages ? post.images : (post.img ? [post.img] : []);

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

	// Removed useEffect hook for fetching user

	const handleDeletePost = async (e) => {
		try {
			e.preventDefault();
			if (!window.confirm("Are you sure you want to delete this post?")) return;

			const res = await fetchWithSession(`/api/posts/${post._id}`, {
				method: "DELETE",
			});
			if (res.ok) {
				await res.json();
				showToast("Success", "Post deleted", "success");
				setPosts(posts.filter((p) => p._id !== post._id));
			} else {
				const errorData = await res.json().catch(() => ({ error: 'Failed to delete post' }));
				showToast("Error", errorData.error || 'Failed to delete post', "error");
			}
		} catch (error) {
			showToast("Error", error.message, "error");
		}
	};

	const handleNotInterested = (e) => {
		e.stopPropagation();
		// Remove post from feed
		setPosts(posts.filter((p) => p._id !== post._id));
		showToast("Success", "Post removed from your feed", "success");
	};

	// Check if post or post.postedBy exists before rendering
	if (!post || !post.postedBy) return null;

	return (
		<Box
			p={4} // Add padding inside the box
			mb={4} // Keep margin between posts
			bg="#1a1a1a" // Slightly lighter background to make the box visible
			borderRadius="xl" // Rounded rectangle box
			border="1px solid rgba(255, 255, 255, 0.08)" // Subtle border for definition
			onClick={(e) => {
				// Navigate on clicking the box, except when clicking interactive elements
				const interactiveElements = ["A", "BUTTON", "IMG", "svg"]; // Tags of elements that shouldn't trigger navigation
				if (
					e.target instanceof Element &&
					!interactiveElements.includes(e.target.tagName) &&
					!e.target.closest("a, button") // Check parent elements too
				) {
					// Use post.postedBy.username for navigation
					navigate(`/${post.postedBy.username}/post/${post._id}`);
				}
			}}
			cursor="pointer" // Indicate the box is clickable
			className="threads-post-card" // Apply our custom class
			_hover={{
				bg: "#1e1e1e", // Slightly lighter on hover
				borderColor: "rgba(255, 255, 255, 0.12)"
			}}
		>
			<Flex gap={3}> {/* Removed mb and py */}
				<Flex flexDirection={"column"} alignItems={"center"}>
					<Avatar
						size='md'
						name={post.postedBy.name} // Use post.postedBy.name
						src={post.postedBy.profilePic} // Use post.postedBy.profilePic
						onClick={(e) => {
							e.preventDefault();
							navigate(`/${post.postedBy.username}`); // Use post.postedBy.username
						}}
					/>
					{/* Removed the vertical line and reply avatars section */}
				</Flex>
				<Flex flex={1} flexDirection={"column"} gap={2}>
					{/* Post Header */}
					<Flex justifyContent={"space-between"} w={"full"} alignItems="center">
						{/* User Info */}
						<Flex alignItems={"center"} gap={2}>
							{/* Link added specifically to username */}
							{/* Use post.postedBy.username */}
							<Link to={`/${post.postedBy.username}`} onClick={(e) => e.stopPropagation()}>
								<Text fontSize={"sm"} fontWeight={"bold"}>
									{post.postedBy.username}
								</Text>
							</Link>
						</Flex>
						{/* Timestamp, Repost Icon, and Menu */}
						<Flex gap={4} alignItems={"center"}>
							{/* Show repost icon if the post has been reposted */}
							{post.reposts && post.reposts.length > 0 && (
								<Box color={"gray.light"}>
									<svg
										aria-label='Repost'
										color="currentColor"
										fill='none'
										height='16'
										width='16'
										role='img'
										viewBox='0 0 24 24'
									>
										<path
											d="M4 9h13l-3-3m9 13H10l3 3M5 5v5h5M19 19v-5h-5"
											stroke='currentColor'
											strokeWidth='1.8'
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</Box>
							)}
							<Text fontSize={"xs"} textAlign={"right"} color={"gray.light"}>
								{formatDistanceToNow(new Date(post.createdAt))} ago
							</Text>

							{/* Three Dots Menu */}
							<Menu placement="bottom-end" isLazy>
								<MenuButton
									as={IconButton}
									icon={
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										>
											<circle cx="12" cy="12" r="1" />
											<circle cx="12" cy="5" r="1" />
											<circle cx="12" cy="19" r="1" />
										</svg>
									}
									variant="ghost"
									aria-label="Options"
									size="sm"
									color="gray.500"
									_hover={{
										color: "white",
										bg: "rgba(0, 204, 133, 0.1)",
										borderColor: "rgba(0, 204, 133, 0.3)"
									}}
									onClick={(e) => e.stopPropagation()}
								/>
								<MenuList
									fontSize="sm"
									bg="#101010"
									borderColor="gray.700"
									minW="180px"
									p={2}
									boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
									className="glass-card"
								>
									{currentUser?._id === post.postedBy._id ? (
										<MenuItem
											icon={
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="14"
													height="14"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
												>
													<path d="M3 6h18"></path>
													<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
													<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
													<line x1="10" y1="11" x2="10" y2="17"></line>
													<line x1="14" y1="11" x2="14" y2="17"></line>
												</svg>
											}
											color="red.400"
											bg="#101010"
											_hover={{
												bg: "rgba(229, 62, 62, 0.1)",
												color: "red.300"
											}}
											borderRadius="md"
											onClick={(e) => {
												e.stopPropagation();
												handleDeletePost(e);
											}}
										>
											Delete post
										</MenuItem>
									) : (
										<MenuItem
											icon={
												<svg
													xmlns="http://www.w3.org/2000/svg"
													width="14"
													height="14"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
												>
													<circle cx="12" cy="12" r="10"></circle>
													<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
												</svg>
											}
											bg="#101010"
											_hover={{
												bg: "rgba(0, 204, 133, 0.1)",
												color: "white"
											}}
											borderRadius="md"
											onClick={(e) => handleNotInterested(e)}
										>
											Not interested
										</MenuItem>
									)}
									<MenuItem
										icon={
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="14"
												height="14"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
												<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
											</svg>
										}
										bg="#101010"
										_hover={{
											bg: "rgba(0, 204, 133, 0.1)",
											color: "white"
										}}
										borderRadius="md"
										onClick={(e) => {
											e.stopPropagation();
											const postUrl = `${window.location.origin}/${post.postedBy.username}/post/${post._id}`;
											navigator.clipboard.writeText(postUrl);
											showToast("Success", "Post link copied to clipboard", "success");
										}}
									>
										Copy link
									</MenuItem>
								</MenuList>
							</Menu>
						</Flex>
					</Flex>

					{/* Post Content */}
					<Text
						fontSize={"sm"}
						mt={1}
						overflowWrap="break-word"
						wordBreak="break-word"
						whiteSpace="pre-wrap"
						sx={{
							hyphens: "auto"
						}}
					>
						{post.text}
					</Text>
					{images.length > 0 && (
						<Box
							borderRadius="xl"
							overflow={"hidden"}
							mt={2}
							position="relative"
							cursor="pointer"
							onClick={(e) => {
								e.stopPropagation();
								// Push a new history state before opening the modal
								window.history.pushState({ modal: 'image' }, '');
								setIsImageModalOpen(true);
							}}
						>
							{/* Main image */}
							<Image
								src={images[currentImageIndex]}
								w={"full"}
								maxH="500px"
								objectFit="cover"
							/>

							{/* Navigation arrows for multiple images */}
							{images.length > 1 && (
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
											onClick={(e) => {
												e.stopPropagation();
												setCurrentImageIndex(prev => prev - 1);
											}}
											size="sm"
										/>
									)}

									{/* Right arrow */}
									{currentImageIndex < images.length - 1 && (
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
											onClick={(e) => {
												e.stopPropagation();
												setCurrentImageIndex(prev => prev + 1);
											}}
											size="sm"
										/>
									)}
								</>
							)}

							{/* Image indicators */}
							{images.length > 1 && (
								<HStack
									spacing={1}
									position="absolute"
									bottom={2}
									left="50%"
									transform="translateX(-50%)"
									justify="center"
								>
									{images.map((_, index) => (
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
							{images.length > 1 && (
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
									{currentImageIndex + 1}/{images.length}
								</Box>
							)}
						</Box>
					)}

					{/* Full-size image modal */}
					{images.length > 0 && (
						<Modal
							isOpen={isImageModalOpen}
							onClose={() => setIsImageModalOpen(false)}
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
									onClick={() => {
										setIsImageModalOpen(false);
									}}
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
											src={images[currentImageIndex]}
											maxH="90vh"
											maxW="90vw"
											objectFit="contain"
										/>

										{/* Image counter in modal */}
										{images.length > 1 && (
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
												{currentImageIndex + 1}/{images.length}
											</Box>
										)}
									</Box>

									{/* Navigation arrows for multiple images in modal */}
									{images.length > 1 && (
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
													onClick={() => setCurrentImageIndex(prev => prev - 1)}
													size="lg"
												/>
											)}

											{/* Right arrow */}
											{currentImageIndex < images.length - 1 && (
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
													onClick={() => setCurrentImageIndex(prev => prev + 1)}
													size="lg"
												/>
											)}
										</>
									)}
								</ModalBody>
							</ModalContent>
						</Modal>
					)}

					{/* Display User's Reply if available (from Replies tab) */}
					{post.userReply && (
						<Box
							mt={3}
							p={3}
							borderRadius="xl"
							bg="#101010"
							className="threads-post-card"
							position="relative"
						>
							{/* Vertical line connector */}
							<Box
								position="absolute"
								left="12px"
								top="-3px" // Extend slightly above the box
								width="2px"
								height="calc(100% - 15px)" // Adjust height to not extend all the way to the bottom
								bg="rgba(113, 118, 123, 0.4)" // Twitter/X style gray line
							/>

							<Flex pl={6}> {/* Add padding to accommodate the vertical line */}
								<Box>
									<Text fontSize="sm" fontStyle="italic" color="gray.light">
										Your reply:
									</Text>
									<Text
										fontSize={"sm"}
										overflowWrap="break-word"
										wordBreak="break-word"
										whiteSpace="pre-wrap"
										sx={{
											hyphens: "auto"
										}}
									>
										{post.userReply.text}
									</Text>
								</Box>
							</Flex>
						</Box>
					)}

					{/* Actions */}
					<Flex gap={3} my={2} onClick={(e) => e.stopPropagation()}> {/* Prevent box navigation */}
						<Actions post={post} />
					</Flex>

					{/* Show replies count if not displaying comments - ONLY on post page or in threads view (not homepage) */}
					{post.replies?.length > 0 && !displayComments && isPostPage && (
						<Button
							variant="ghost"
							size="sm"
							colorScheme="gray"
							leftIcon={
								<svg
									aria-label='Comment'
									color={"currentColor"}
									fill='none'
									height='18'
									role='img'
									viewBox='0 0 24 24'
									width='18'
									strokeWidth='1.8'
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path
										d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5L2.5 21.5l4.5-.838A9.955 9.955 0 0012 22z"
										stroke='currentColor'
									/>
								</svg>
							}
							onClick={(e) => {
								e.stopPropagation();
								setDisplayComments(true);
							}}
						>
							Show {post.replies.length} {post.replies.length === 1 ? "reply" : "replies"}
						</Button>
					)}

					{/* Comments Section */}
					{displayComments && post.replies?.length > 0 && (
						<Box mt={4}>
							{post.replies
								// First filter to get only top-level replies
								.filter(reply => !reply.parentReplyId)
								// Then sort by popularity (likes and replies count)
								.sort((a, b) => {
									// Calculate engagement score based on likes and replies
									const aLikes = a.likes?.length || 0;
									const bLikes = b.likes?.length || 0;

									// Count replies to this comment
									const aReplies = post.replies.filter(r => r.parentReplyId === a._id).length;
									const bReplies = post.replies.filter(r => r.parentReplyId === b._id).length;

									// Total engagement score
									const aScore = aLikes + aReplies;
									const bScore = bLikes + bReplies;

									// If scores are equal, sort by newest first
									if (bScore === aScore) {
										return new Date(b.createdAt) - new Date(a.createdAt);
									}

									// Sort by engagement score (highest first)
									return bScore - aScore;
								})
								.map((reply, index) => (
								<Comment
									key={reply._id}
									reply={reply}
									postId={post._id}
									lastReply={index === post.replies.filter(r => !r.parentReplyId).length - 1}
									onReplyAdded={(newReply) => {
										const updatedPosts = posts.map((p) => {
											if (p._id === post._id) {
												return { ...p, replies: [...p.replies, newReply] };
											}
											return p;
										});
										setPosts(updatedPosts);
									}}
									childReplies={post.replies.filter(r => r.parentReplyId === reply._id)}
									allReplies={post.replies}
								/>
							))}

							{/* Hide comments button */}
							<Button
								variant="ghost"
								size="sm"
								colorScheme="gray"
								mt={2}
								onClick={(e) => {
									e.stopPropagation();
									setDisplayComments(false);
								}}
							>
								Hide replies
							</Button>
						</Box>
					)}
				</Flex>
			</Flex>
		</Box> // Close the main Box
	);
};

export default Post;
