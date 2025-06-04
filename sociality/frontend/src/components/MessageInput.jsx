import {
	Flex,
	Input,
	InputGroup,
	InputRightElement,
} from "@chakra-ui/react";
import { IoSendSharp } from "react-icons/io5";
import useShowToast from "../hooks/useShowToast";
import { useRecoilValue, useSetRecoilState } from "recoil";
import { userAtom, conversationsAtom, selectedConversationAtom } from "../atoms";
import usePreviewImg from "../hooks/usePreviewImg";
import { memo, useState, useCallback } from "react";
import { fetchWithSession } from "../utils/api";


const MessageInput = memo(({ setMessages }) => {
	const [messageText, setMessageText] = useState("");
	const showToast = useShowToast();
	const selectedConversation = useRecoilValue(selectedConversationAtom);
	const setConversations = useSetRecoilState(conversationsAtom);
	const currentUser = useRecoilValue(userAtom);
	const { imgUrl, setImgUrl } = usePreviewImg();
	const [isSending, setIsSending] = useState(false);
	const [selectedEmoji, setSelectedEmoji] = useState("");

	// Define sendRequestFn to handle both regular and federated messages
	const sendRequestFn = useCallback(async (formData, messageData) => {
		let responseData = null;

		// Handle federated messages
		if (selectedConversation.isFederated) {
			console.log("Sending federated message:", messageData.text);
			const response = await fetchWithSession("/api/cross-platform/rooms/" + selectedConversation._id + "/messages", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: messageData.text
				}),
			});
			responseData = await response.json();
			console.log("Federated message response:", responseData);

			// For federated messages, transform the response to match expected format
			if (responseData.success && responseData.localMessage) {
				return {
					_id: responseData.localMessage.id,
					text: responseData.localMessage.text,
					sender: responseData.localMessage.sender._id,
					senderUsername: responseData.localMessage.sender.username,
					senderPlatform: responseData.localMessage.sender.platform,
					createdAt: responseData.localMessage.timestamp,
					isFederated: true,
					platform: responseData.localMessage.platform,
					tempId: messageData.tempId
				};
			}
		} else {
			// Handle regular messages
			if (formData) {
				const response = await fetchWithSession("/api/messages", {
					method: "POST",
					body: formData,
				});
				responseData = await response.json();
			} else {
				const response = await fetchWithSession("/api/messages", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(messageData),
				});
				responseData = await response.json();
			}
		}

		console.log("Message sent successfully (server response):", responseData);
		return responseData;
	}, [selectedConversation.isFederated, selectedConversation._id]);

	// PATCH: Define messageAlreadyUpdated utility
	const messageAlreadyUpdated = (prev, tempId, responseData) => {
		return prev.some(msg =>
			(msg.tempId === tempId && !msg.isOptimistic) ||
			(responseData._id && msg._id === responseData._id)
		);
	};

	// Handle message submission
	const handleSendMessage = useCallback(async (e) => {
		e?.preventDefault();
		if (isSending) return;
		if (!messageText.trim() && !imgUrl && !selectedEmoji) {
			console.warn('Attempted to send empty message. Aborting.');
			return;
		}
		setIsSending(true);
		try {
			const tempId = Date.now().toString();
			let formData = null;
			let messageData = {
				tempId,
				text: messageText,
				recipientId: selectedConversation.userId,
				img: imgUrl || undefined,
				emoji: selectedEmoji || undefined,
			};

			// For federated messages, don't use images/emojis for now
			if (selectedConversation.isFederated && (imgUrl || selectedEmoji)) {
				showToast("Info", "Images and emojis are not supported in cross-platform rooms yet", "info");
				setIsSending(false);
				return;
			}
			// Prepare message with any media type
			if (imgUrl) {
				formData = new FormData();
				formData.append("text", messageText);
				formData.append("recipientId", selectedConversation.userId);
				if (imgUrl && imgUrl.startsWith("blob:")) {
					const response = await fetch(imgUrl);
					const imgBlob = await response.blob();
					formData.append("img", imgBlob);
				}
				if (selectedEmoji) {
					formData.append("emoji", selectedEmoji);
				}
			}
			const optimisticMessage = selectedConversation.isFederated ? {
				_id: tempId,
				text: messageText,
				sender: currentUser._id,
				senderUsername: currentUser.name || currentUser.username,
				senderPlatform: 'sociality',
				createdAt: new Date().toISOString(),
				isOptimistic: true,
				isNew: true,
				isFederated: true,
				platform: 'sociality',
				tempId
			} : {
				text: messageText,
				sender: currentUser._id,
				tempId,
				createdAt: new Date().toISOString(),
				isOptimistic: true,
				isNew: true,
				img: imgUrl || undefined,
				emoji: selectedEmoji || undefined,
			};
			setMessages(prev => [...prev, optimisticMessage]);

			// Immediate aggressive scroll trigger for optimistic message
			const forceImmediateScroll = () => {
				const messageContainer = document.getElementById('messageListContainer');
				if (messageContainer) {
					console.log('📤 Immediate aggressive scroll after sending message');
					// Force scroll to absolute maximum
					messageContainer.scrollTop = messageContainer.scrollHeight;
					console.log('📤 Set scrollTop to:', messageContainer.scrollTop);
				}
			};

			// Multiple immediate scroll attempts
			setTimeout(forceImmediateScroll, 10);
			setTimeout(forceImmediateScroll, 50);
			setTimeout(forceImmediateScroll, 100);

			try {
				console.log("Waiting for server to process message...");
				const responseData = await sendRequestFn(formData, messageData);
				setMessages(prev => {
					if (messageAlreadyUpdated(prev, tempId, responseData)) {
						console.log("Message already updated by socket, skipping update");
						return prev;
					}
					const updatedMessages = prev.map(msg =>
						msg.tempId === tempId ? { ...responseData, isNew: true } : msg
					);

					return updatedMessages;
				});
				setConversations(prev => {
					const updatedConversations = [...prev];
					const conversationIndex = updatedConversations.findIndex(c => c._id === selectedConversation._id);
					if (conversationIndex !== -1) {
						updatedConversations[conversationIndex] = {
							...updatedConversations[conversationIndex],
							lastMessage: {
								text: messageText,
								sender: currentUser._id,
								img: imgUrl ? true : undefined,
								emoji: selectedEmoji || undefined,
							},
						};
						const conversation = updatedConversations.splice(conversationIndex, 1)[0];
						updatedConversations.unshift(conversation);
					}
					return updatedConversations;
				});


			} catch (error) {
				showToast("Error", error.message, "error");
			}
			document.getElementById('messageInput')?.blur();
			setMessageText("");
			setImgUrl("");
			setSelectedEmoji("");
		} catch (error) {
			showToast("Error", error.message, "error");
		} finally {
			setIsSending(false);
		}
	}, [
		messageText,
		imgUrl,
		selectedEmoji,
		selectedConversation?.userId,
		selectedConversation?._id,
		selectedConversation?.isFederated,
		currentUser?._id,
		currentUser?.username,
		currentUser?.name,
		isSending,
		sendRequestFn,
		setMessages,
		showToast,
		setImgUrl,
		setConversations
	]);

	return (
		<Flex
			gap={3}
			alignItems={"center"}
			p={2}
			mb={{ base: 2, md: 0 }} // Add extra margin bottom on mobile for better spacing
		>
			<form onSubmit={handleSendMessage} style={{ flex: 1 }}>
				<InputGroup>
					<Input
						w={"full"}
						placeholder='Type a message...'
						onChange={(e) => setMessageText(e.target.value)}
						value={messageText}
						bg="rgba(30, 30, 30, 0.4)"
						borderColor="rgba(255, 255, 255, 0.05)"
						color="white"
						borderRadius="full"
						py={{ base: 5, md: 6 }} // Slightly smaller padding on mobile
						px={4}
						_focus={{ borderColor: "rgba(0, 204, 133, 0.3)", boxShadow: "0 0 0 1px rgba(0, 204, 133, 0.2)" }}
						_hover={{ borderColor: "rgba(255, 255, 255, 0.1)", bg: "rgba(30, 30, 30, 0.5)" }}
						fontSize={{ base: "sm", md: "md" }} // Responsive font size
						transition="all 0.2s ease"
						id="messageInput"
					/>
					<InputRightElement width="5rem" h="full">
						<Flex gap={3} pr={3} alignItems="center">
							{/* Only send button remains */}
							<Flex onClick={handleSendMessage} cursor={"pointer"} color={messageText.trim() ? "#00CC85" : "gray.light"} _hover={{ color: messageText.trim() ? "#00CC85" : "white", transform: "translateY(-2px) scale(1.1)", textShadow: messageText.trim() ? "0 0 8px rgba(0, 204, 133, 0.5)" : "none" }} transition="all 0.2s ease" p={2} borderRadius="full">
								<IoSendSharp size={20} />
							</Flex>
						</Flex>
					</InputRightElement>
				</InputGroup>
			</form>
		</Flex>
	);
});

MessageInput.displayName = 'MessageInput';

export default MessageInput;
