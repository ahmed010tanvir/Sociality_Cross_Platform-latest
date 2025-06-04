import { Avatar, Box, Button, Flex, Image, Spinner, Text, IconButton, Textarea, CloseButton, Menu, MenuButton, MenuList, MenuItem, Divider } from "@chakra-ui/react";
import { BsFillImageFill } from "react-icons/bs";
import Actions from "../components/Actions";
import { useEffect, useState, useRef } from "react";
import Comment from "../components/Comment";
import useGetUserProfile from "../hooks/useGetUserProfile";
import useShowToast from "../hooks/useShowToast";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useRecoilState, useRecoilValue } from "recoil";
import { userAtom, postsAtom } from "../atoms";
import { useSocket } from "../hooks/useSocket";
import { fetchWithSession } from "../utils/api";

const PostPage = () => {
	const { user, loading } = useGetUserProfile();
	const [posts, setPosts] = useRecoilState(postsAtom);
	const showToast = useShowToast();
	const { pid } = useParams();
	const currentUser = useRecoilValue(userAtom);
	const navigate = useNavigate();
	const location = useLocation();
	const { socket } = useSocket();

	// Extract parameters from the URL query string
	const searchParams = new URLSearchParams(location.search);
	const highlightReplyId = searchParams.get('highlight');

	// This is a temporary flag that only applies for this viewing session
	// It doesn't persist when the user navigates away and comes back

	// State for direct reply
	const [replyText, setReplyText] = useState("");
	const [replyImage, setReplyImage] = useState(null);
	const [imagePreview, setImagePreview] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const imageRef = useRef(null);

	// State for showing/hiding replies
	const [showReplies, setShowReplies] = useState(true);

	// Always show replies if there's a highlighted reply
	useEffect(() => {
		if (highlightReplyId) {
			setShowReplies(true);
		}
	}, [highlightReplyId]);

	// Socket.io event listeners for real-time updates
	useEffect(() => {
		if (!socket) {
			console.log("Socket not available for post updates");
			return;
		}

		console.log("Setting up socket event listeners for post updates");

		// Handler for post updates (new replies)
		const handlePostUpdate = (data) => {
			console.log("Post update received:", data);

			// Only process updates for the current post
			if (data.postId !== pid) {
				console.log("Ignoring update for different post:", data.postId);
				return;
			}

			// Handle new reply
			if (data.type === "newReply" || data.type === "nestedReply") {
				console.log("New reply received:", data.reply);

				// Make sure replies are visible
				setShowReplies(true);

				// Force a re-fetch of the post to get the latest data
				// This ensures we have the most up-to-date information
				const fetchLatestPost = async () => {
					try {
						console.log("Fetching latest post data after receiving new reply");
						const res = await fetchWithSession(`/api/posts/${pid}`);
						const data = await res.json();

						if (data.error) {
							console.error("Error fetching latest post:", data.error);
							return;
						}

						// Sort replies by creation date (newest first)
						if (data.replies && data.replies.length > 0) {
							data.replies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
						}

						console.log("Updated post data received:", data);
						setPosts([data]);
					} catch (error) {
						console.error("Error fetching latest post:", error);
					}
				};

				// Call the fetch function
				fetchLatestPost();

				// Also update the UI immediately for better responsiveness
				setPosts(prevPosts => {
					console.log("Current posts state:", prevPosts);

					return prevPosts.map(post => {
						if (post._id === data.postId) {
							// Check if this reply already exists (to prevent duplicates)
							const replyExists = post.replies.some(r => r._id === data.reply._id);

							if (!replyExists) {
								console.log("Adding new reply to post");
								// Add the new reply to the beginning of the array
								return {
									...post,
									replies: [data.reply, ...post.replies]
								};
							} else {
								console.log("Reply already exists, not adding duplicate");
							}
						}
						return post;
					});
				});

				// No notification needed when already viewing the post
				// The reply is automatically added to the UI
			}
		};

		// Set up event listeners
		socket.on("postUpdate", handlePostUpdate);

		// Clean up event listeners
		return () => {
			socket.off("postUpdate", handlePostUpdate);
		};
	}, [socket, pid, setPosts]);

	const currentPost = posts[0];

	useEffect(() => {
		const getPost = async () => {
			setPosts([]);
			try {
				const res = await fetchWithSession(`/api/posts/${pid}`);
				const data = await res.json();
				if (data.error) {
					showToast("Error", data.error, "error");
					return;
				}

				// Sort replies by creation date (newest first)
				if (data.replies && data.replies.length > 0) {
					data.replies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
				}

				setPosts([data]);

				// Delete any reply notifications for this post when viewing it
				// This automatically clears notifications when the user views the post
				if (currentUser) {
					try {
						await fetchWithSession(`/api/notifications/post/${pid}/type/comment`, {
							method: "DELETE",
						});
						// No need to show a toast for this operation
					} catch (error) {
						console.error("Error deleting notifications:", error);
						// Don't show error to user as this is a background operation
					}
				}
			} catch (error) {
				showToast("Error", error.message, "error");
			}
		};
		getPost();
	}, [showToast, pid, setPosts, currentUser]);

	const handleDeletePost = async () => {
		try {
			if (!window.confirm("Are you sure you want to delete this post?")) return;

			const res = await fetchWithSession(`/api/posts/${currentPost._id}`, {
				method: "DELETE",
			});
			const data = await res.json();
			if (data.error) {
				showToast("Error", data.error, "error");
				return;
			}
			showToast("Success", "Post deleted", "success");
			navigate(`/${user.username}`);
		} catch (error) {
			showToast("Error", error.message, "error");
		}
	};

	// Handle image upload for reply
	const handleImageChange = (e) => {
		const file = e.target.files[0];
		if (file) {
			setReplyImage(file);
			setImagePreview(URL.createObjectURL(file));
		}
	};

	// Handle direct reply submission to the main post
	const handleReplySubmit = async (e) => {
		e.preventDefault();
		console.log("Submitting reply...");

		// Check if user is logged in
		if (!user) {
			showToast("Error", "You must be logged in to reply", "error");
			return;
		}

		// Check if reply is empty
		if (!replyText.trim()) {
			showToast("Error", "Reply cannot be empty", "error");
			return;
		}

		try {
			setIsSubmitting(true);
			console.log("Socket connection status:", socket ? "Connected" : "Not connected");

			// Prepare image for optimistic update
			let tempImageUrl = null;
			if (replyImage) {
				tempImageUrl = URL.createObjectURL(replyImage);
			}

			// Create temporary reply for optimistic update
			const tempId = Date.now().toString();
			const tempReply = {
				_id: tempId,
				text: replyText,
				img: tempImageUrl,
				username: user.username,
				userProfilePic: user.profilePic,
				userId: user._id,
				createdAt: new Date().toISOString(),
				likes: [],
				isOptimistic: true // flag to identify this is a temp reply
			};

			console.log("Created temporary reply:", tempReply);

			// Make sure replies are visible
			setShowReplies(true);

			// Update UI immediately with optimistic data
			const updatedPosts = posts.map(p => {
				if (p._id === currentPost._id) {
					// Add the new reply at the beginning of the array for immediate visibility
					console.log("Adding optimistic reply to post:", p._id);
					return {
						...p,
						replies: [tempReply, ...(p.replies || [])]
					};
				}
				return p;
			});
			setPosts(updatedPosts);
			console.log("Updated posts with optimistic reply");

			// Reset form
			setReplyText("");
			setReplyImage(null);
			setImagePreview(null);

			// Prepare image data for server
			let imgUrl = null;
			if (replyImage) {
				const reader = new FileReader();
				const imgPromise = new Promise((resolve) => {
					reader.onload = (e) => resolve(e.target.result);
					reader.readAsDataURL(replyImage);
				});
				imgUrl = await imgPromise;
			}

			console.log("Sending reply to server...");
			// Send request to server
			const res = await fetchWithSession(`/api/posts/reply/${currentPost._id}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: replyText,
					img: imgUrl,
				}),
			});

			const data = await res.json();
			console.log("Server response:", data);

			if (data.error) {
				console.error("Error from server:", data.error);
				// If error, revert the optimistic update
				const revertedPosts = posts.map(p => {
					if (p._id === currentPost._id) {
						return {
							...p,
							replies: p.replies.filter(r => r._id !== tempId)
						};
					}
					return p;
				});
				setPosts(revertedPosts);

				throw new Error(data.error);
			}

			// Update posts state with the actual server data
			const updatedPostsWithRealData = posts.map(p => {
				if (p._id === currentPost._id) {
					// Replace the temporary reply with the real one from the server
					const updatedReplies = p.replies.map(r =>
						r._id === tempId ? data.reply : r
					);

					// Make sure the new reply is at the top for visibility
					return {
						...p,
						replies: updatedReplies
					};
				}
				return p;
			});
			setPosts(updatedPostsWithRealData);

			// No toast notification needed when already viewing the post
			// The reply is already visible in the UI

		} catch (error) {
			showToast("Error", error.message, "error");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!user && loading) {
		return (
			<Flex justifyContent={"center"}>
				<Spinner size={"xl"} />
			</Flex>
		);
	}

	if (!currentPost) return null;

	return (
		<>
			{/* Main Post */}
			<Box
				bg="#101010"
				borderRadius="xl"
				p={4}
				mb={6}
				className="threads-post-card"
			>
				<Flex justifyContent="space-between" mb={4}>
					<Flex alignItems={"center"} gap={3}>
						<Link to={`/${user.username}`}>
							<Avatar src={user.profilePic} size={"md"} name={user.name} />
						</Link>
						<Flex flexDirection="column">
							<Link to={`/${user.username}`}>
								<Text fontSize={"sm"} fontWeight={"bold"} color="white" _hover={{ textDecoration: "underline" }}>
									{user.username}
								</Text>
							</Link>
							<Text fontSize="xs" color="gray.400">
								{formatDistanceToNow(new Date(currentPost.createdAt))} ago
							</Text>
						</Flex>
					</Flex>

					{/* Three dots menu with improved styling */}
					<Box>
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
								{currentUser?._id === user._id ? (
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
										onClick={handleDeletePost}
									>
										Delete post
									</MenuItem>
								) : null}
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
									onClick={() => {
										const currentURL = window.location.href;
										navigator.clipboard.writeText(currentURL);
										showToast("Success", "Post link copied to clipboard", "success");
									}}
								>
									Copy link
								</MenuItem>
							</MenuList>
						</Menu>
					</Box>

				</Flex>

				<Text
					my={3}
					color="white"
					overflowWrap="break-word"
					wordBreak="break-word"
					whiteSpace="pre-wrap"
					sx={{
						hyphens: "auto"
					}}
				>
					{currentPost.text}
				</Text>

				{currentPost.img && (
					<Box
						borderRadius="md"
						overflow={"hidden"}
						borderWidth="1px"
						borderColor="gray.700"
						mt={4}
					>
						<Image src={currentPost.img} w={"full"} />
					</Box>
				)}

				<Flex gap={3} mt={4}>
					<Actions
						post={currentPost}
					/>
				</Flex>
			</Box>

			{/* X-style Comment Input Box with transparent green border */}
			<Box
				bg="#101010"
				borderRadius="md"
				borderWidth="1px"
				borderColor="rgba(0, 204, 133, 0.3)"
				boxShadow="0 0 0 1px rgba(0, 204, 133, 0.2)"
				p={4}
				mb={4}
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
				<Flex mt={2} mb={2} gap={3}>
					<Avatar
						src={currentUser?.profilePic}
						size="sm"
						name={currentUser?.username}
					/>
					<Flex
						direction="column"
						width="full"
					>
						<Textarea
							placeholder="Share your thoughts..."
							value={replyText}
							onChange={(e) => setReplyText(e.target.value)}
							resize="none"
							minH="60px"
							bg="transparent"
							border="none"
							p={0}
							_focus={{ border: "none", boxShadow: "none" }}
							fontSize="sm"
							color="gray.300"
						/>

						{/* Image Preview */}
						{imagePreview && (
							<Box
								position="relative"
								mt={2}
								mb={2}
								borderRadius="md"
								overflow="hidden"
								maxW="300px"
							>
								<Image
									src={imagePreview}
									maxH="150px"
									objectFit="cover"
								/>
								<IconButton
									icon={<CloseButton />}
									aria-label="Remove image"
									size="xs"
									position="absolute"
									top={1}
									right={1}
									bg="rgba(0, 0, 0, 0.7)"
									color="white"
									borderRadius="full"
									onClick={() => {
										setReplyImage(null);
										setImagePreview(null);
									}}
								/>
							</Box>
						)}

						<Flex justify="space-between" align="center" mt={2} borderTop="1px solid" borderColor="gray.700" pt={2}>
							<Box>
								<input
									type="file"
									hidden
									ref={imageRef}
									onChange={handleImageChange}
								/>
								<IconButton
									aria-label="Add image"
									icon={<BsFillImageFill />}
									variant="ghost"
									colorScheme="gray"
									size="sm"
									onClick={() => imageRef.current.click()}
								/>
							</Box>

							<Button
								size="sm"
								bg="white"
								color="black"
								borderRadius="full"
								px={5}
								fontWeight="bold"
								_hover={{ bg: "gray.200" }}
								isDisabled={!replyText.trim() && !replyImage}
								isLoading={isSubmitting}
								onClick={handleReplySubmit}
							>
								Reply
							</Button>
						</Flex>
					</Flex>
				</Flex>
			</Box>

			{/* Replies Section */}
			{currentPost.replies?.length > 0 && (
				<Box
					borderTop={"1px solid"}
					borderBottom={"1px solid"}
					borderColor={"whiteAlpha.300"}
					mt={4}
					py={2}
				>
					<Flex justifyContent="space-between" alignItems="center" mb={4}>
						<Text fontWeight="bold" color="white">
							Replies
						</Text>
						<Flex alignItems="center" gap={4}>
							<Text color="gray.400" fontSize="sm">
								{currentPost.replies.length}
							</Text>
							<Button
								variant="ghost"
								color="gray.400"
								size="sm"
								onClick={() => setShowReplies(!showReplies)}
							>
								{showReplies ? "Hide" : "Show"}
							</Button>
						</Flex>
					</Flex>

					{showReplies && (
						<>
							{/* Render only top-level replies, each comment manages its own child replies */}
							{(() => {
								// Add null check to filter out any undefined or invalid replies
								const validReplies = currentPost.replies?.filter(reply => reply && reply._id) || [];

								// Get only top-level replies (those without parentReplyId)
								let topLevelReplies = validReplies.filter(reply => !reply.parentReplyId);

								// Check for any optimistic updates (temporary replies)
								const hasOptimisticUpdates = topLevelReplies.some(reply => reply.isOptimistic);

								if (hasOptimisticUpdates) {
									// If we have optimistic updates, sort by newest first to show the new reply at the top
									topLevelReplies = topLevelReplies.sort((a, b) => {
										// Always put optimistic updates at the top
										if (a.isOptimistic) return -1;
										if (b.isOptimistic) return 1;

										// Otherwise sort by creation date (newest first)
										return new Date(b.createdAt) - new Date(a.createdAt);
									});
								} else {
									// By default, sort by popularity (likes count and replies count)
									topLevelReplies = topLevelReplies.sort((a, b) => {
										// Calculate engagement score based on likes and replies
										const aLikes = a.likes?.length || 0;
										const bLikes = b.likes?.length || 0;

										// Count replies to this comment
										const aReplies = validReplies.filter(r => r.parentReplyId === a._id).length;
										const bReplies = validReplies.filter(r => r.parentReplyId === b._id).length;

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
								}

								// If there's a highlighted reply, move it to the top of the list
								// This is a temporary change just for this viewing session
								if (highlightReplyId) {
									// Extract the highlighted reply
									const highlightedReply = topLevelReplies.find(r => r._id === highlightReplyId);

									// If found, remove it from its current position and add it to the top
									if (highlightedReply) {
										topLevelReplies = topLevelReplies.filter(r => r._id !== highlightReplyId);
										topLevelReplies.unshift(highlightedReply);
									}
								}

								return topLevelReplies.map((reply, index) => (
									<Box key={reply._id} mb={4}>
										{/* Add a separator after the highlighted reply if it's the first one */}
										{index === 0 && reply._id === highlightReplyId && (
											<>
												<Box
													mb={4}
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
												{topLevelReplies.length > 1 && (
													<Box
														mb={4}
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
											reply={reply}
											postId={currentPost._id}
											lastReply={index === topLevelReplies.length - 1}
											onReplyAdded={(newReply) => {
												// Update the post replies array with the new nested reply
												const updatedPosts = posts.map((p) => {
													if (p._id === currentPost._id) {
														return {
															...p,
															replies: [...(p.replies || []), newReply],
														};
													}
													return p;
												});
												setPosts(updatedPosts);
											}}
											// Pass child replies that belong to this comment
											childReplies={validReplies.filter(r => r.parentReplyId === reply._id)}
											// Pass all replies for deeper nesting
											allReplies={validReplies}
											// Pass the highlight ID to highlight the specific reply
											highlightId={highlightReplyId}
										/>
									</Box>
								));
							})()}
						</>
					)}
				</Box>
			)}
		</>
	);
};

export default PostPage;
