import { useEffect, useState } from "react";
import UserHeader from "../components/UserHeader";
import { useParams } from "react-router-dom";
import useShowToast from "../hooks/useShowToast";
import { Flex, Spinner } from "@chakra-ui/react";
import Post from "../components/Post";
import useGetUserProfile from "../hooks/useGetUserProfile";
import { useRecoilState } from "recoil";
import { postsAtom } from "../atoms";
import CreatePost from "../components/CreatePost";

const UserPage = () => {
    const { user: initialUser, loading } = useGetUserProfile();
    const [user, setUser] = useState(null);
    const { username } = useParams();
    const showToast = useShowToast();
    const [posts, setPosts] = useRecoilState(postsAtom);
    const [fetchingPosts, setFetchingPosts] = useState(true);
    const [filterType, setFilterType] = useState("posts"); // State for selected tab

    // Update local user state when initialUser changes
    useEffect(() => {
        if (initialUser) {
            console.log('User profile data loaded:', initialUser);
            console.log('Followers:', initialUser.followers);
            console.log('Following:', initialUser.following);
            setUser(initialUser);
        }
    }, [initialUser]);

    useEffect(() => {
        const getFilteredContent = async () => { // Renamed function
            if (!user) return;
            setFetchingPosts(true);
            setPosts([]); // Clear previous posts when filter changes
            let apiUrl = `/api/posts/user/${username}`; // Default to posts
            if (filterType === "replies") {
                apiUrl = `/api/posts/user/${username}/replies`; // Assuming this endpoint
            } else if (filterType === "reposts") {
                apiUrl = `/api/posts/user/${username}/reposts`; // Assuming this endpoint
            }

            try {
                const res = await fetch(apiUrl);

                if (res.ok) {
                    const data = await res.json(); // Only parse JSON if response is OK
                    setPosts(data);
                } else {
                    // Handle non-OK responses (like 404)
                    const errorMessage = await res.text(); // Try to get error text from body
                    console.error("Fetch error:", res.status, errorMessage); // Log for debugging
                    showToast("Error", `Failed to fetch ${filterType}. Endpoint might not exist (Status: ${res.status}): ${errorMessage}`, "error");
                    setPosts([]);
                }
            } catch (error) { // Catch network errors or other unexpected issues
                showToast("Error", error.message, "error");
                setPosts([]);
            } finally {
                setFetchingPosts(false);
            }
        };

        getFilteredContent(); // Call the renamed function
    }, [username, showToast, setPosts, user, filterType]); // Added filterType dependency

    const handlePostCreated = (newPost) => {
        setPosts((prevPosts) => [newPost, ...prevPosts]); // Add the new post to the top of the feed
    };

    // Handler for user profile updates
    const handleUserUpdate = (updatedUser) => {
        if (updatedUser) {
            console.log('UserPage received updated user data:', {
                followers: updatedUser.followers?.length || 0,
                following: updatedUser.following?.length || 0
            });

            // Update the user state with the new data
            setUser(updatedUser);
        }
    };

    if ((!user && !initialUser) && loading) {
        return (
            <Flex justifyContent={"center"}>
                <Spinner size={"xl"} />
            </Flex>
        );
    }

    if ((!user && !initialUser) && !loading) return <h1>User not found</h1>;

    // Don't render until we have user data
    if (!user) return null;

    return (
        <>
            {/* Pass tab state and handler to UserHeader */}
            <UserHeader
                user={user}
                selectedTab={filterType}
                onTabChange={setFilterType}
                onUserUpdate={handleUserUpdate}
            />
            {/* Create Post Component */}
            <CreatePost onPostCreated={handlePostCreated} />

            {/* Posts Section */}
            {fetchingPosts && (
                <Flex justifyContent={"center"} my={12}>
                    <Spinner size={"xl"} />
                </Flex>
            )}

            {/* Updated empty state message */}
            {!fetchingPosts && posts.length === 0 && <h1>No {filterType} found.</h1>}

            {posts.map((post) => (
                <Post post={post} key={post._id} isPostPage={false}/>
            ))}
        </>
    );
};

export default UserPage;
