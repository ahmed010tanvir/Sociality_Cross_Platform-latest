import {
	Avatar,
	AvatarBadge,
	Box,
	Flex,
	Text,
	WrapItem,
	Tooltip,
} from "@chakra-ui/react";
import { useRecoilState, useRecoilValue } from "recoil";
import { userAtom, selectedConversationAtom } from "../atoms";
import { BsCheck2All, BsFillImageFill } from "react-icons/bs";
import { format, formatDistanceToNow } from "date-fns";
import { memo, useCallback, useMemo } from "react";

const Conversation = memo(({ conversation, isOnline, lastSeen, setSelectedConversation }) => {
	// Add safety check for when participants is empty or undefined
	const user = conversation?.participants?.[0] || {};
	const currentUser = useRecoilValue(userAtom);
	const lastMessage = conversation?.lastMessage || {};
	const setSelectedConversationRecoil = useRecoilState(selectedConversationAtom)[1];
	const selectedConversation = useRecoilValue(selectedConversationAtom);

	// Format timestamp if available - memoized to prevent recreation on every render
	const timeString = useMemo(() => {
		if (conversation?.lastMessage?.createdAt) {
			return format(new Date(conversation.lastMessage.createdAt), 'h:mm a');
		}
		return '';
	}, [conversation?.lastMessage?.createdAt]);

	// Format last seen timestamp - memoized to prevent recreation on every render
	const lastSeenString = useMemo(() => {
		if (!isOnline && lastSeen) {
			return `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`;
		}
		return '';
	}, [isOnline, lastSeen]);

	// Optimize the click handler with useCallback to prevent recreation on every render
	const handleClick = useCallback(() => {
		const conversationData = {
			_id: conversation._id,
			userId: user._id,
			userProfilePic: user.profilePic,
			username: user.username,
			mock: conversation.mock,
		};

		// Use the prop function if provided, otherwise use recoil
		if (setSelectedConversation) {
			setSelectedConversation(conversationData);
		} else {
			setSelectedConversationRecoil(conversationData);
		}
	}, [conversation._id, user._id, user.profilePic, user.username, conversation.mock, setSelectedConversation, setSelectedConversationRecoil]);

	// Precompute the conversation active state
	const isActive = useMemo(() =>
		selectedConversation?._id === conversation._id,
	[selectedConversation?._id, conversation._id]);

	// Memoize the last message content for better performance
	const lastMessageContent = useMemo(() => {
		if (lastMessage.text) {
			return <Text as="span">{lastMessage.text}</Text>;
		} else if (conversation.lastMessage?.img) {
			return (
				<Flex alignItems="center">
					<BsFillImageFill size={16} style={{ marginRight: '4px' }} />
					<Text as="span">Image</Text>
				</Flex>
			);
		} else if (conversation.lastMessage?.gif) {
			return <Text as="span">GIF</Text>;
		} else if (conversation.lastMessage?.voice) {
			return <Text as="span">Voice message</Text>;
		} else if (conversation.lastMessage?.file) {
			return <Text as="span">File: {conversation.lastMessage?.fileName || 'Document'}</Text>;
		} else if (conversation.lastMessage?.emoji) {
			return <Text as="span">{conversation.lastMessage.emoji}</Text>;
		} else {
			return <Text as="span">New conversation</Text>;
		}
	}, [lastMessage.text, conversation.lastMessage]);

	// If there's no valid participant, don't render the conversation
	if (!user._id) return null;

	return (
		<Flex
			gap={2} /* Reduced gap */
			alignItems={"center"}
			p={2} /* Reduced padding */
			_hover={{
				cursor: "pointer",
				bg: "#1e1e1e",
			}}
			onClick={handleClick}
			bg={isActive ? "#1e1e1e" : "transparent"}
			borderRadius={"md"}
			position="relative"
			overflow="hidden"
			transition="all 0.2s ease"
			borderBottom="1px solid"
			borderColor="gray.800"
			width="100%"
			height="auto" /* Auto height */
			minH="50px" /* Minimum height */
			maxH="60px" /* Maximum height */
		>
			{/* Active indicator - left border for selected conversation */}
			{isActive && (
				<Box
					position="absolute"
					left={0}
					top={0}
					bottom={0}
					width="2px"
					bg="gray.500"
				/>
			)}

			<WrapItem>
				<Tooltip
					label={isOnline ? "Online" : lastSeenString}
					placement="top"
					hasArrow
				>
					<Box position="relative">
						<Avatar
							size="sm" /* Always small size */
							src={user.profilePic}
							border={isOnline ? "1px solid #00CC85" : "1px solid #be0510"}
						>
							{isOnline ? (
								<AvatarBadge
									boxSize='1em'
									bg='#00CC85'
									style={{
										boxShadow: '0 0 8px 2px #00CC85, 0 0 2px 1px #00CC85'
									}}
								/>
							) : (
								<AvatarBadge
									boxSize='1em'
									bg='#be0510'
									style={{
										boxShadow: '0 0 8px 2px #be0510, 0 0 2px 1px #be0510'
									}}
								/>
							)}
						</Avatar>
					</Box>
				</Tooltip>
			</WrapItem>

			<Flex direction="column" flex={1} overflow="hidden">
				<Flex justify="space-between" align="center" width="100%">
					<Flex alignItems="center" gap={1}>
						<Text
							fontWeight={lastMessage.seen ? '400' : '600'}
							display="flex"
							alignItems="center"
							color="white"
						>
							{user.username}
						</Text>
						{isOnline ? (
							<Text fontSize="xs" color="#00CC85" fontWeight="medium">
								• online
							</Text>
						) : (
							<Text fontSize="xs" color="#be0510" fontWeight="medium">
								• offline
							</Text>
						)}
					</Flex>

					{/* Time stamp */}
					<Text fontSize="xs" color="gray.500">
						{timeString}
					</Text>
				</Flex>

				<Flex align="center">
					<Flex
						fontSize="sm"
						color="gray.400"
						fontWeight={lastMessage.seen ? "normal" : "medium"}
						noOfLines={1}
						overflow="hidden"
						textOverflow="ellipsis"
						whiteSpace="nowrap"
						alignItems="center"
						gap={1}
						width="100%"
					>
						{currentUser._id === lastMessage.sender && (
							<Box color={lastMessage.seen ? "gray.500" : "gray.600"}>
								<BsCheck2All size={16} />
							</Box>
						)}

						{lastMessageContent}
					</Flex>
				</Flex>
			</Flex>
		</Flex>
	);
});

Conversation.displayName = 'Conversation';

export default Conversation;
