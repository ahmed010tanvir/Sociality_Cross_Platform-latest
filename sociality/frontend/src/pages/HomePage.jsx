import React from 'react';
import {
    Box,
    Flex,
    Spinner,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import useShowToast from "../hooks/useShowToast";
import Post from "../components/post/Post";
import { useRecoilState, useRecoilValue } from "recoil";
import { postsAtom, userAtom } from "../atoms";
import SuggestedUsers from "../components/SuggestedUsers";
import CreatePost from "../components/CreatePost";
import { fetchWithSession } from "../utils/api";

const HomePage = () => {
    const [posts, setPosts] = useRecoilState(postsAtom);
    const [loading, setLoading] = useState(true);
    const showToast = useShowToast();
    const user = useRecoilValue(userAtom);

    useEffect(() => {
        const getFeedPosts = async () => {
            setLoading(true);
            setPosts([]);
            try {
                const res = await fetchWithSession("/api/posts/feed");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setPosts(data);
                    } else {
                        showToast("Error", "Invalid data format", "error");
                    }
                } else {
                    const errorData = await res.json().catch(() => ({ error: 'Failed to fetch posts' }));

                    // For 401 errors, provide more helpful message for new users
                    if (res.status === 401) {
                        console.log('Authentication error on homepage, user might need to re-login');
                        showToast("Info", "Please refresh the page or log in again to see posts", "info");
                    } else {
                        showToast("Error", errorData.error || 'Failed to fetch posts', "error");
                    }
                }
            } catch (error) {
                console.error('Homepage posts fetch error:', error);
                showToast("Error", error.message, "error");
            } finally {
                setLoading(false);
            }
        };

        // Small delay for new users who just completed profile setup
        const delay = user && user.isProfileComplete ? 500 : 0;
        setTimeout(getFeedPosts, delay);
    }, [showToast, setPosts, user]);

    const handlePostCreated = (newPost) => {
        setPosts((prevPosts) => [newPost, ...prevPosts]); // Add the new post to the top of the feed
    };

    return (
        <Flex gap="6" justify="center">
            {/* Main Content */}
            <Box flex={{ base: 1, md: 2 }} maxW="600px" position="relative" zIndex={1}>
                {/* Create Post Component */}
                <CreatePost onPostCreated={handlePostCreated} />

                {/* Posts */}
                {loading && (
                    <Flex justify="center" my="6">
                        <Spinner size="xl" />
                    </Flex>
                )}

                {!loading && posts.length === 0 && (
                    <Box textAlign="center" my="6">
                        <h1>No posts to display. Try following some users or check back later!</h1>
                    </Box>
                )}

                {Array.isArray(posts) &&
                    posts.map((post, index) => (
                        <React.Fragment key={post._id}>
                            <Post post={post} isPostPage={false} />
                            {index === 1 && ( // Show SuggestedUsers only after the second post (index 1)
                                <Box my="6">
                                    <SuggestedUsers />
                                </Box>
                            )}
                        </React.Fragment>
                    ))}


                {!loading && !Array.isArray(posts) && (
                    <Box textAlign="center" my="6">
                        <h1>Error loading posts. Please try again later.</h1>
                    </Box>
                )}
            </Box>

            {/* Suggested Users Section Removed */}
            {/* <Box
                flex={1}
                display={{ base: "none", md: "block" }}
                position="sticky"
                top="80px"
                maxH="80vh"
                overflowY="auto"
            >
                <SuggestedUsers />
            </Box> */}
        </Flex>
    );
};

export default HomePage;
