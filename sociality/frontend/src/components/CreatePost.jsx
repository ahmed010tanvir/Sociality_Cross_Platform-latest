import { AddIcon, ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import {
	Button,
	CloseButton,
	Flex,
	FormControl,
	Image,
	Input,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Text,
	Textarea,

	useDisclosure,
	Avatar,
	Box,
	IconButton,
	HStack,
	Circle,
} from "@chakra-ui/react";
import { useRef, useState } from "react";
import usePreviewImg from "../hooks/usePreviewImg";
import { BsFillImageFill } from "react-icons/bs";
import { useRecoilState, useRecoilValue } from "recoil";
import { userAtom, postsAtom } from "../atoms";
import useShowToast from "../hooks/useShowToast";
import { useParams } from "react-router-dom";
import { fetchWithSession } from "../utils/api";

const MAX_CHAR = 500;

const CreatePost = ({ onPostCreated }) => {
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [postText, setPostText] = useState("");
	const {
		handleImageChange,
		setImgUrl,
		imgUrls,
		setImgUrls,
		removeImage,
		clearImages
	} = usePreviewImg();
	const imageRef = useRef(null);
	const [remainingChar, setRemainingChar] = useState(MAX_CHAR);
	const user = useRecoilValue(userAtom);
	const showToast = useShowToast();
	const [loading, setLoading] = useState(false);
	const [posts, setPosts] = useRecoilState(postsAtom);
	const { username } = useParams();
	const [currentImageIndex, setCurrentImageIndex] = useState(0);

	const handleTextChange = (e) => {
		const inputText = e.target.value;

		if (inputText.length > MAX_CHAR) {
			const truncatedText = inputText.slice(0, MAX_CHAR);
			setPostText(truncatedText);
			setRemainingChar(0);
		} else {
			setPostText(inputText);
			setRemainingChar(MAX_CHAR - inputText.length);
		}
	};

	const handleCreatePost = async () => {
		setLoading(true);
		try {
			// Backend now supports multiple images
			const res = await fetchWithSession("/api/posts/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					postedBy: user._id,
					text: postText,
					img: imgUrls.length > 0 ? imgUrls[0] : null, // For backward compatibility
					images: imgUrls // Send all images as an array
				}),
			});

			if (res.ok) {
				const data = await res.json();
				showToast("Success", "Post created successfully", "success");
				// Call the callback function if provided
				if (onPostCreated) {
					onPostCreated(data);
				} else if (username === user.username) {
					// Fallback to old behavior if no callback
					setPosts([data, ...posts]);
				}
			} else {
				const errorData = await res.json().catch(() => ({ error: 'Failed to create post' }));
				showToast("Error", errorData.error || 'Failed to create post', "error");
				return;
			}
			onClose();
			setPostText("");
			setImgUrl("");
			setImgUrls([]);
			setCurrentImageIndex(0);
		} catch (error) {
			showToast("Error", error, "error");
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<Box
				position={"fixed"}
				bottom={10}
				right={5}
				bg="brand.primary.500"
				color="white"
				onClick={onOpen}
				borderRadius="full"
				boxShadow="0 0 20px rgba(0, 204, 133, 0.3)"
				width="50px"
				height="50px"
				display="flex"
				alignItems="center"
				justifyContent="center"
				borderWidth="1px"
				borderColor="rgba(255, 255, 255, 0.1)"
				zIndex={999}
				cursor="pointer"
				transition="all 0.3s ease"
				_hover={{
					bg: "brand.primary.400",
					transform: "scale(1.1) rotate(180deg)",
					boxShadow: "0 0 25px rgba(0, 204, 133, 0.5)"
				}}
				className="brand-button"
			>
				<AddIcon boxSize={6} />
			</Box>

			<Modal isOpen={isOpen} onClose={onClose}>
				<ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />

				<ModalContent
					className="glass-card"
					bg="rgba(16, 16, 16, 0.8)"
					color="white"
					borderColor="rgba(255, 255, 255, 0.05)"
					borderWidth="1px"
					borderRadius="xl"
					boxShadow="0 8px 32px 0 rgba(0, 0, 0, 0.3)"
				>
					<ModalHeader>Create Post</ModalHeader>
					<ModalCloseButton />
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
									{/* Text Input Area */}
									<Textarea
										placeholder="What's happening?"
										value={postText}
										onChange={handleTextChange}
										mb="3"
										bg="rgba(0, 0, 0, 0.2)"
										borderColor="rgba(255, 255, 255, 0.1)"
										borderWidth="1px"
										borderRadius="md"
										_focus={{ borderColor: "brand.primary.500", boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.3)" }}
										_hover={{ borderColor: "brand.secondary.500" }}
										minH="100px"
										fontSize="md"
										resize="none"
										className="glass-card"
									/>
									<Text fontSize='xs' fontWeight='bold' textAlign={"right"} mb={2} color={"gray.400"}>
										{remainingChar}/{MAX_CHAR}
									</Text>
								</FormControl>

								{/* Image Preview */}
								{imgUrls.length > 0 && (
									<Box
										mt={2}
										mb={4}
										position={"relative"}
										borderRadius="lg"
										overflow="hidden"
										borderWidth="1px"
										borderColor="rgba(255, 255, 255, 0.1)"
										boxShadow="0 4px 12px rgba(0, 0, 0, 0.2)"
										transition="all 0.3s ease"
										_hover={{ boxShadow: "0 6px 16px rgba(0, 204, 133, 0.2)" }}
										className="glass-card"
									>
										{/* Image */}
										<Image
											src={imgUrls[currentImageIndex]}
											alt={`Selected image ${currentImageIndex + 1}`}
											maxH="300px"
											objectFit="cover"
											w="full"
										/>

										{/* Navigation arrows */}
										{imgUrls.length > 1 && (
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
														onClick={() => setCurrentImageIndex(prev => prev - 1)}
													/>
												)}

												{/* Right arrow */}
												{currentImageIndex < imgUrls.length - 1 && (
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
														onClick={() => setCurrentImageIndex(prev => prev + 1)}
													/>
												)}
											</>
										)}

										{/* Image indicators */}
										{imgUrls.length > 1 && (
											<HStack
												spacing={1}
												position="absolute"
												bottom={2}
												left="50%"
												transform="translateX(-50%)"
												justify="center"
											>
												{imgUrls.map((_, index) => (
													<Circle
														key={index}
														size={2}
														bg={index === currentImageIndex ? "white" : "rgba(255,255,255,0.5)"}
														cursor="pointer"
														onClick={() => setCurrentImageIndex(index)}
													/>
												))}
											</HStack>
										)}

										{/* Image counter */}
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
											{currentImageIndex + 1}/{imgUrls.length}
										</Box>

										{/* Add More Images Button */}
										<IconButton
											icon={<AddIcon />}
											aria-label="Add more images"
											position="absolute"
											bottom={2}
											right={10}
											borderRadius="full"
											bg="rgba(0, 204, 133, 0.7)"
											color="white"
											_hover={{ bg: "rgba(0, 204, 133, 0.9)" }}
											onClick={() => imageRef.current.click()}
											size="sm"
											title="Add more images"
										/>

										{/* Close button */}
										<CloseButton
											onClick={() => {
												if (imgUrls.length === 1) {
													clearImages();
												} else {
													removeImage(currentImageIndex);
													if (currentImageIndex >= imgUrls.length - 1) {
														setCurrentImageIndex(imgUrls.length - 2);
													}
												}
											}}
											bg={"rgba(0,0,0,0.7)"}
											color="white"
											position={"absolute"}
											top={2}
											right={2}
											size="sm"
											borderRadius="full"
											_hover={{ bg: "rgba(255, 0, 0, 0.7)" }}
										/>
									</Box>
								)}

								{/* Action Buttons */}
								<Flex justify="space-between" align="center" mt={2}>
									<Flex align="center">
										<Input
											type='file'
											hidden
											ref={imageRef}
											onChange={handleImageChange}
											multiple // Allow multiple file selection
											accept="image/*" // Only accept image files
										/>
										<IconButton
											aria-label="Add images"
											icon={<BsFillImageFill />}
											onClick={() => imageRef.current.click()}
											variant="ghost"
											color="brand.secondary.500"
											_hover={{ color: "brand.secondary.400", bg: "rgba(0, 121, 185, 0.1)" }}
											size="md"
											borderRadius="full"
											title="Add multiple images"
										/>
									</Flex>

									<Button
										bg="brand.primary.500"
										color="white"
										_hover={{ bg: "brand.primary.600", transform: "translateY(-2px)" }}
										isLoading={loading}
										onClick={handleCreatePost}
										isDisabled={!postText.trim() && imgUrls.length === 0}
										borderRadius="md"
										px={6}
										py={3}
										fontWeight="bold"
										size="md"
										borderWidth="1px"
										borderColor="rgba(255, 255, 255, 0.1)"
										boxShadow="0 4px 12px rgba(0, 204, 133, 0.2)"
										transition="all 0.2s"
										className="brand-button"
									>
										Post
									</Button>
								</Flex>
							</Flex>
						</Flex>
					</ModalBody>
				</ModalContent>
			</Modal>
		</>
	);
};

export default CreatePost;
