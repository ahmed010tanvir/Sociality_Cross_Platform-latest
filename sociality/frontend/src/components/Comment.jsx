import {
	Avatar,
	Divider,
	Flex,
	Text,
	Box,
	Image,
	Button,
	Textarea,
	IconButton,
	CloseButton,
	useDisclosure,
	useToast,
	Menu,
	MenuButton,
	MenuList,
	MenuItem,
	AlertDialog,
	AlertDialogBody,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogContent,
	AlertDialogOverlay
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { BsFillImageFill, BsThreeDotsVertical } from "react-icons/bs";
import { formatDistanceToNow } from "date-fns";
import { useRecoilState, useRecoilValue } from "recoil";
import { userAtom, postsAtom } from "../atoms";
import useShowToast from "../hooks/useShowToast";
import { fetchWithSession } from "../utils/api";
import { useSocket } from "../hooks/useSocket";
import { Heart, ChatCircle, Trash } from "phosphor-react";

const Comment = ({ reply, lastReply, postId, onReplyAdded, childReplies = [], allReplies = [], highlightId = null }) => {
	// We get the highlightId directly as a prop
	const navigate = useNavigate();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [replyText, setReplyText] = useState("");
	const [replyImage, setReplyImage] = useState(null);
	const [imagePreview, setImagePreview] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [liked, setLiked] = useState(false);
	const [isLiking, setIsLiking] = useState(false);
	const [showReplies, setShowReplies] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
	const cancelRef = useRef();
	const imageRef = useRef(null);
	const currentUser = useRecoilValue(userAtom);
	const [posts, setPosts] = useRecoilState(postsAtom);
	const showToast = useShowToast();
	const toast = useToast();
	const { socket } = useSocket();

	// State for highlighting the reply - moved to top to avoid conditional hooks
	const [isHighlighted, setIsHighlighted] = useState(false);
	const [showNewBadge, setShowNewBadge] = useState(false);

	// Initialize like state based on reply likes
	useEffect(() => {
		if (reply?.likes && currentUser) {
			setLiked(reply.likes.includes(currentUser._id));
		}
	}, [reply?.likes, currentUser]);

	// Calculate values needed for other effects
	const isThisReplyHighlighted = highlightId && reply?._id === highlightId;
	const containsHighlightedReply = !isThisReplyHighlighted && highlightId && childReplies?.some(
		child => child._id === highlightId || allReplies?.some(
			r => r.parentReplyId === child._id && r._id === highlightId
		)
	);

	// Set highlighted state when the component mounts or highlightId changes
	useEffect(() => {
		if (isThisReplyHighlighted) {
			setIsHighlighted(true);
			setShowNewBadge(true);

			// Keep the "New Reply" badge for 10 seconds to make it more noticeable
			const timer = setTimeout(() => {
				setShowNewBadge(false);
			}, 10000);

			return () => clearTimeout(timer);
		}
	}, [isThisReplyHighlighted]);

	// Auto-expand replies if this comment or any of its children is highlighted
	useEffect(() => {
		if (isHighlighted || containsHighlightedReply) {
			setShowReplies(true);
		}
	}, [isHighlighted, containsHighlightedReply]);

	// Effect to scroll to highlighted reply
	useEffect(() => {
		if (isHighlighted && reply?._id) {
			// Add a small delay to ensure the DOM is ready
			const timer = setTimeout(() => {
				const element = document.getElementById(`reply-${reply._id}`);
				if (element) {
					element.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [isHighlighted, reply?._id]);

	// Socket.io event listeners for real-time updates
	useEffect(() => {
		if (!socket || !reply?._id) {
			return;
		}

		// Handler for post updates (new replies)
		const handlePostUpdate = (data) => {
			// Only process updates for the current post
			if (data.postId !== postId) {
				return;
			}

			// Handle nested replies to this comment
			if (data.type === "nestedReply" && data.parentReplyId === reply._id) {
				// Make sure replies are visible
				setShowReplies(true);

				// Call the onReplyAdded callback to update the parent component
				if (onReplyAdded) {
					onReplyAdded(data.reply);
				}

				// Force a re-render by toggling the state
				setShowReplies(false);
				setTimeout(() => setShowReplies(true), 10);
			}

			// Handle comment deletion
			if (data.type === "commentDeleted" && data.commentId === reply._id) {
				// Remove the comment from the UI
				const updatedPosts = posts.map(p => {
					if (p._id === postId) {
						return {
							...p,
							replies: p.replies.filter(r => r._id !== reply._id)
						};
					}
					return p;
				});
				setPosts(updatedPosts);
			}
		};

		// Set up event listeners
		socket.on("postUpdate", handlePostUpdate);

		// Clean up event listeners
		return () => {
			socket.off("postUpdate", handlePostUpdate);
		};
	}, [socket, postId, reply?._id, onReplyAdded, posts, setPosts]);

	// Check if reply is valid before proceeding
	if (!reply || !reply._id) {
		console.log("Invalid reply object:", reply);
		return null;
	}

	// Handle image upload for reply
	const handleImageChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			setReplyImage(file);
			setImagePreview(URL.createObjectURL(file));
		}
	};

	// Handle like/unlike for comment
	const handleLikeComment = async () => {
		if (!currentUser) {
			showToast("Error", "You must be logged in to like a comment", "error");
			return;
		}
		if (isLiking) return;

		setIsLiking(true);
		try {
			// Set liked state optimistically for better UX
			setLiked(!liked);

			// Send API request to update like status on the server
			const res = await fetchWithSession(`/api/posts/comment/like/${postId}/${reply._id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				}
			});

			if (res.ok) {
				await res.json();
			} else {
				const errorData = await res.json().catch(() => ({ error: 'Failed to like/unlike comment' }));
				// Revert optimistic update if there was an error
				setLiked(liked);
				throw new Error(errorData.error || 'Failed to like/unlike comment');
			}

			// Update posts state to reflect the change
			const updatedPosts = posts.map(p => {
				if (p._id === postId) {
					return {
						...p,
						replies: p.replies.map(r => {
							if (r._id === reply._id) {
								// Update likes array based on current action
								const newLikes = liked
									? r.likes.filter(id => id !== currentUser._id) // Unlike: remove user ID
									: [...(r.likes || []), currentUser._id]; // Like: add user ID

								return {
									...r,
									likes: newLikes
								};
							}
							return r;
						})
					};
				}
				return p;
			});

			setPosts(updatedPosts);

			showToast("Success", liked ? "Comment unliked" : "Comment liked", "success");
		} catch (error) {
			showToast("Error", error.message, "error");
			// Revert optimistic update on error
			setLiked(liked);
		} finally {
			setIsLiking(false);
		}
	};

	// Handle reply submission
	const handleReplySubmit = async () => {
		if (!currentUser) {
			showToast("Error", "You must be logged in to reply", "error");
			return;
		}

		if (!replyText.trim() && !replyImage) {
			showToast("Error", "Reply cannot be empty", "error");
			return;
		}

		// Ensure reply and postId exist
		if (!reply || !reply._id || !postId) {
			showToast("Error", "Missing required reply information", "error");
			return;
		}

		setIsSubmitting(true);

		try {
			// Convert image to base64 if it exists
			let imgUrl = null;
			if (replyImage) {
				const reader = new FileReader();
				const imgPromise = new Promise((resolve) => {
					reader.onload = (e) => resolve(e.target.result);
					reader.readAsDataURL(replyImage);
				});
				imgUrl = await imgPromise;
			}

			// Create new reply object with proper fields
			const newReply = {
				text: replyText,
				img: imgUrl,
				parentReplyId: reply._id,
				username: currentUser.username,
				userProfilePic: currentUser.profilePic,
				userId: currentUser._id,
				createdAt: new Date().toISOString(),
				// Generate a temporary ID until server responds
				_id: `temp-${Date.now()}`
			};

			// Optimistically update UI by calling the callback immediately
			if (onReplyAdded) {
				onReplyAdded(newReply);
			}

			// Show replies when a new one is added
			setShowReplies(true);

			// Then send to server
			const res = await fetchWithSession(`/api/posts/reply/${postId}/comment/${reply._id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: replyText,
					img: imgUrl,
					parentReplyId: reply._id, // Set this reply as the parent
				}),
			});

			let responseData = null;
			if (res.ok) {
				responseData = await res.json();
			} else {
				const errorData = await res.json().catch(() => ({ error: 'Failed to reply to comment' }));
				showToast("Error", errorData.error || 'Failed to reply to comment', "error");
				return;
			}

			// Use the toast instance from the top level
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
									navigate(`/${reply.username}/post/${postId}?highlight=${responseData?._id || newReply._id}`);
								}}
								ml={3}
							>
								View
							</Button>
						</Flex>
					</Box>
				)
			});

			// Reset form and close reply box
			setReplyText("");
			setReplyImage(null);
			setImagePreview(null);
			onClose();
		} catch (error) {
			showToast("Error", error.message, "error");
		} finally {
			setIsSubmitting(false);
		}
	};

	// Check if this is a nested reply
	const isNestedReply = reply.parentReplyId !== null && reply.parentReplyId !== undefined;

	// Get username or fallback
	const username = reply.username || "User";

	// Safely format date
	const timeAgo = reply.createdAt ? formatDistanceToNow(new Date(reply.createdAt)) : "recently";

	// Check if this comment has replies
	const hasReplies = childReplies && childReplies.length > 0;



	// Handle comment deletion
	const handleDeleteComment = async () => {
		if (!currentUser) {
			showToast("Error", "You must be logged in to delete a comment", "error");
			return;
		}

		setIsDeleting(true);
		try {
			// Optimistic update - remove the comment from the UI immediately
			const updatedPosts = posts.map(p => {
				if (p._id === postId) {
					return {
						...p,
						replies: p.replies.filter(r => r._id !== reply._id)
					};
				}
				return p;
			});
			setPosts(updatedPosts);

			// Close the delete alert
			setIsDeleteAlertOpen(false);

			// Send API request to delete the comment
			const res = await fetchWithSession(`/api/posts/comment/${postId}/${reply._id}`, {
				method: "DELETE"
			});

			if (res.ok) {
				await res.json();
			} else {
				const errorData = await res.json().catch(() => ({ error: 'Failed to delete comment' }));
				throw new Error(errorData.error || 'Failed to delete comment');
			}

			showToast("Success", "Comment deleted successfully", "success");
		} catch (error) {
			showToast("Error", error.message, "error");

			// Revert the optimistic update if there was an error
			const originalPost = posts.find(p => p._id === postId);
			if (originalPost) {
				const updatedPosts = posts.map(p => {
					if (p._id === postId) {
						return originalPost;
					}
					return p;
				});
				setPosts(updatedPosts);
			}
		} finally {
			setIsDeleting(false);
		}
	};



	return (
		<>
			<Box
				id={`reply-${reply._id}`}
				position="relative"
				px={0}
				py={2}
				ml={isNestedReply ? 4 : 0}
				w="full"
				bg={isHighlighted ? "rgba(0, 204, 133, 0.1)" : "transparent"}
				borderRadius="md"
				transition="background-color 0.3s ease"
				_before={isHighlighted ? {
					content: '""',
					position: "absolute",
					top: "-1px",
					right: "-1px",
					bottom: "-1px",
					left: "-1px",
					borderRadius: "md",
					border: "1px solid rgba(0, 204, 133, 0.3)",
					pointerEvents: "none"
				} : {}}
			>
				{/* Line connector for nested replies */}
				{isNestedReply && (
					<Box
						position="absolute"
						left="-12px"
						top="0"
						bottom="0"
						width="2px"
						height="100%"
						bg="rgba(113, 118, 123, 0.4)"
					/>
				)}

				{/* Horizontal connector line */}
				{isNestedReply && (
					<Box
						position="absolute"
						left="-12px"
						top="15px"
						width="8px"
						height="2px"
						bg="rgba(113, 118, 123, 0.4)"
					/>
				)}

				<Flex gap={2}>
					<Link to={`/${username}`}>
						<Avatar src={reply.userProfilePic} size="xs" />
					</Link>

					<Flex direction="column" flex={1}>
						{/* Username and timestamp */}
						<Flex align="center" gap={1} justify="space-between" width="100%">
							<Flex align="center" gap={1}>
								<Text fontWeight="bold" fontSize="sm" color="white">
									{username}
								</Text>
								<Text fontSize="xs" color="gray.500">
									· {timeAgo} ago
								</Text>
								{showNewBadge && (
									<Text
										fontSize="xs"
										color="green.400"
										fontWeight="bold"
										ml={1}
										bg="rgba(0, 204, 133, 0.1)"
										px={2}
										py={0.5}
										borderRadius="full"
										border="1px solid rgba(0, 204, 133, 0.3)"
									>
										Your New Reply
									</Text>
								)}
							</Flex>

							{/* Three dots menu */}
							{currentUser && (currentUser._id === reply.userId) && (
								<Menu placement="bottom-end" isLazy>
									<MenuButton
										as={IconButton}
										icon={<BsThreeDotsVertical />}
										variant="ghost"
										size="xs"
										color="gray.500"
										aria-label="Comment options"
										_hover={{
											color: "white",
											bg: "rgba(0, 204, 133, 0.1)",
											borderColor: "rgba(0, 204, 133, 0.3)"
										}}
									/>
									<MenuList
										minW="180px"
										bg="#101010"
										borderColor="gray.700"
										p={2}
										boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
										className="glass-card"
									>
										<MenuItem
											icon={<Trash size={14} />}
											bg="#101010"
											_hover={{
												bg: "rgba(229, 62, 62, 0.1)",
												color: "red.300"
											}}
											color="red.400"
											borderRadius="md"
											onClick={() => setIsDeleteAlertOpen(true)}
										>
											Delete comment
										</MenuItem>
									</MenuList>
								</Menu>
							)}
						</Flex>

						{/* Reply content */}
						<Text
							fontSize="sm"
							color="gray.300"
							mt={0.5}
							mb={1}
							overflowWrap="break-word"
							wordBreak="break-word"
							whiteSpace="pre-wrap"
							sx={{
								hyphens: "auto"
							}}
						>
							{reply.text || ""}
						</Text>

						{/* Reply image */}
						{reply.img && (
							<Box
								mt={1}
								mb={2}
								borderRadius="md"
								overflow="hidden"
								maxW="85%"
								borderWidth="1px"
								borderColor="gray.700"
							>
								<Image
									src={reply.img}
									maxH="200px"
									objectFit="cover"
								/>
							</Box>
						)}

						{/* Action buttons */}
						<Flex mt={1} gap={4}>
							{/* Reply icon */}
							<Box
								onClick={onOpen}
								className="clean-icon"
							>
								<ChatCircle
									size={20}
									weight="regular"
									color="#616161"
								/>
							</Box>

							{/* Like icon */}
							<Box
								onClick={handleLikeComment}
								className="clean-icon"
							>
								<Heart
									size={20}
									weight={liked ? "fill" : "regular"}
									color={liked ? "#ff3b5c" : "#616161"}
								/>
							</Box>
						</Flex>

						{/* Show/hide replies button */}
						{hasReplies && (
							<Flex
								mt={2}
								ml={1}
								align="center"
								onClick={() => setShowReplies(!showReplies)}
								cursor="pointer"
								width="fit-content"
							>
								<Text
									fontSize="xs"
									color="blue.400"
									fontWeight="medium"
									_hover={{ textDecoration: "underline" }}
								>
									{showReplies ? "Hide" : "Show"} {childReplies.length} {childReplies.length === 1 ? "reply" : "replies"}
								</Text>
							</Flex>
						)}

						{/* Reply form with transparent green border */}
						{isOpen && (
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
												position={"relative"}
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
													onClick={handleReplySubmit}
													isDisabled={!replyText.trim() && !replyImage}
												>
													Reply
												</Button>
											</Flex>
										</Flex>
									</Flex>
								</Flex>
							</Box>
						)}

						{/* Child replies (conditionally rendered) */}
						{showReplies && hasReplies && (
							<Box mt={2}>
								{(() => {
									// Create a sorted copy of child replies
									let sortedChildReplies = [...childReplies];

									// By default, sort by popularity (likes count and replies count)
									sortedChildReplies = sortedChildReplies.sort((a, b) => {
										// Calculate engagement score based on likes and replies
										const aLikes = a.likes?.length || 0;
										const bLikes = b.likes?.length || 0;

										// Count replies to this comment
										const aReplies = allReplies.filter(r => r.parentReplyId === a._id).length;
										const bReplies = allReplies.filter(r => r.parentReplyId === b._id).length;

										// Total engagement score
										const aScore = aLikes + aReplies;
										const bScore = bLikes + bReplies;

										// If scores are equal, sort by newest first
										if (bScore === aScore) {
											return new Date(b.createdAt) - new Date(a.createdAt);
										}

										// Sort by engagement score (highest first)
										return bScore - aScore;
									});

									// If there's a highlighted reply, extract it and move it to the top
									// This is a temporary change just for this viewing session
									if (highlightId) {
										const highlightedReply = sortedChildReplies.find(r => r._id === highlightId);
										if (highlightedReply) {
											sortedChildReplies = sortedChildReplies.filter(r => r._id !== highlightId);
											sortedChildReplies.unshift(highlightedReply);
										}
									}

									return sortedChildReplies.map((childReply, index) => (
										<Box key={childReply._id}>
											{/* Add a separator after the highlighted reply if it's the first one */}
											{index === 0 && childReply._id === highlightId && (
												<>
													<Box
														mb={2}
														position="relative"
														_after={{
															content: '"Your Recent Reply"',
															position: "absolute",
															top: "50%",
															left: "50%",
															transform: "translate(-50%, -50%)",
															bg: "#101010",
															px: "12px",
															py: "4px",
															fontSize: "xs",
															fontWeight: "bold",
															color: "green.400",
															borderRadius: "full",
															border: "1px solid rgba(0, 204, 133, 0.3)"
														}}
													>
														<Divider borderColor="rgba(0, 204, 133, 0.3)" />
													</Box>
													{/* Add a second separator to show where the normal sorting begins */}
													{sortedChildReplies.length > 1 && (
														<Box
															mb={2}
															position="relative"
															_after={{
																content: '"Other Replies"',
																position: "absolute",
																top: "50%",
																left: "50%",
																transform: "translate(-50%, -50%)",
																bg: "#101010",
																px: "12px",
																py: "4px",
																fontSize: "xs",
																color: "gray.500",
																borderRadius: "full"
															}}
														>
															<Divider borderColor="gray.700" />
														</Box>
													)}
												</>
											)}
											<Comment
												reply={childReply}
												postId={postId}
												lastReply={index === sortedChildReplies.length - 1}
												onReplyAdded={onReplyAdded}
												childReplies={allReplies.filter(r => r.parentReplyId === childReply._id)}
												allReplies={allReplies}
												highlightId={highlightId}
											/>
										</Box>
									));
								})()}
							</Box>
						)}
					</Flex>
				</Flex>
			</Box>
			{!lastReply && <Divider my={0.5} borderColor="gray.700" opacity={0.2} />}

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				isOpen={isDeleteAlertOpen}
				leastDestructiveRef={cancelRef}
				onClose={() => setIsDeleteAlertOpen(false)}
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
								onClick={() => setIsDeleteAlertOpen(false)}
								variant="outline"
								borderColor="gray.600"
								color="gray.300"
								_hover={{ bg: "gray.700" }}
							>
								Cancel
							</Button>
							<Button
								colorScheme="red"
								onClick={handleDeleteComment}
								ml={3}
								isLoading={isDeleting}
							>
								Delete
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialogOverlay>
			</AlertDialog>
		</>
	);
};

export default Comment;
