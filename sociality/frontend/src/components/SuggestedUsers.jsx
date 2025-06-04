import { Box, Flex, Skeleton, SkeletonCircle, Text, IconButton } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import SuggestedUser from "./SuggestedUser";
import useShowToast from "../hooks/useShowToast";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { fetchWithSession } from "../utils/api";

const SuggestedUsers = () => {
    const [loading, setLoading] = useState(true);
    const [suggestedUsers, setSuggestedUsers] = useState([]);
    const showToast = useShowToast();


    useEffect(() => {
        const getSuggestedUsers = async () => {
            setLoading(true);
            try {
                const res = await fetchWithSession("/api/users/suggested");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setSuggestedUsers(data); // Only set if data is an array
                    } else {
                        showToast("Error", "Invalid data format", "error");
                    }
                } else {
                    const errorData = await res.json().catch(() => ({ error: 'Failed to fetch suggested users' }));
                    showToast("Error", errorData.error || 'Failed to fetch suggested users', "error");
                }
            } catch (error) {
                showToast("Error", error.message, "error");
            } finally {
                setLoading(false);
            }
        };

        getSuggestedUsers();
    }, [showToast]);

    // Custom arrow components for the slider with transparent styling
    const PrevArrow = (props) => {
        const { onClick } = props;
        return (
            <IconButton
                aria-label="Previous slide"
                icon={<ChevronLeftIcon />}
                onClick={onClick}
                position="absolute"
                left="-12px"
                top="50%"
                transform="translateY(-50%)"
                zIndex={2}
                bg="rgba(30, 30, 30, 0.7)" // Transparent background matching the card color
                color="white"
                borderWidth="1px"
                borderColor="rgba(255, 255, 255, 0.1)" // Subtle border
                borderRadius="full"
                size="sm"
                boxShadow="none" // Remove shadow for cleaner look
                _hover={{
                    bg: "rgba(40, 40, 40, 0.8)", // Slightly darker on hover
                    transform: "translateY(-50%) scale(1.1)",
                }}
                transition="all 0.2s ease"
                className="transparent-nav-button"
            />
        );
    };

    const NextArrow = (props) => {
        const { onClick } = props;
        return (
            <IconButton
                aria-label="Next slide"
                icon={<ChevronRightIcon />}
                onClick={onClick}
                position="absolute"
                right="-12px"
                top="50%"
                transform="translateY(-50%)"
                zIndex={2}
                bg="rgba(30, 30, 30, 0.7)" // Transparent background matching the card color
                color="white"
                borderWidth="1px"
                borderColor="rgba(255, 255, 255, 0.1)" // Subtle border
                borderRadius="full"
                size="sm"
                boxShadow="none" // Remove shadow for cleaner look
                _hover={{
                    bg: "rgba(40, 40, 40, 0.8)", // Slightly darker on hover
                    transform: "translateY(-50%) scale(1.1)",
                }}
                transition="all 0.2s ease"
                className="transparent-nav-button"
            />
        );
    };

    const settings = {
        dots: false,
        infinite: suggestedUsers.length > 3,
        speed: 500,
        slidesToShow: 3,
        slidesToScroll: 1,
        prevArrow: <PrevArrow />,
        nextArrow: <NextArrow />,
        cssEase: "cubic-bezier(0.4, 0, 0.2, 1)", // Smooth transition
        centerMode: false,
        variableWidth: false,
        swipeToSlide: true, // Allow users to swipe to next slide
        responsive: [
            {
                breakpoint: 1024,
                settings: {
                    slidesToShow: 3,
                    slidesToScroll: 1,
                    infinite: suggestedUsers.length > 3,
                }
            },
            {
                breakpoint: 600,
                settings: {
                    slidesToShow: 2,
                    slidesToScroll: 1,
                }
            },
            {
                breakpoint: 480,
                settings: {
                    slidesToShow: 1,
                    slidesToScroll: 1
                }
            }
        ]
    };

    return (
        <Box
            position="relative"
            py={5}
            px={3}
            bg="#181818" // Slightly darker than the user cards
            borderRadius="2xl" // More rounded corners like Threads
            borderWidth="1px"
            borderColor="rgba(255, 255, 255, 0.08)"
            mb={6}
            className="transparent-slider-container" // Apply our custom class for the container
        >
            <Text mb={4} fontWeight={"bold"} color="white" fontSize="lg" px={2}>
                Suggested Users
            </Text>
            {loading ? (
                <Flex direction={"row"} gap={4} px={2}>
                    {[0, 1, 2].map((_, idx) => (
                        <Flex
                            key={idx}
                            gap={2}
                            alignItems={"center"}
                            p={4}
                            borderRadius={"2xl"}
                            bg="#1E1E1E" // Match the user card color
                            flex="1"
                            flexDirection="column"
                            minH="180px"
                            justifyContent="center"
                            borderWidth="1px"
                            borderColor="rgba(255, 255, 255, 0.08)"
                            className="suggested-user-card"
                        >
                            <SkeletonCircle size={"16"} mb={2} />
                            <Skeleton h={"10px"} w={"80px"} mb={2} />
                            <Skeleton h={"10px"} w={"60px"} mb={4} />
                            <Skeleton h={"30px"} w={"100px"} />
                        </Flex>
                    ))}
                </Flex>
            ) : (
                <Box px={2} position="relative" className="transparent-slider-wrapper">
                    <Slider {...settings} className="transparent-slider">
                        {Array.isArray(suggestedUsers) && suggestedUsers.map((user) => (
                            <SuggestedUser key={user._id} user={user} />
                        ))}
                    </Slider>
                </Box>
            )}
            {!loading && Array.isArray(suggestedUsers) && suggestedUsers.length === 0 && (
                <Text color="gray.400" textAlign="center" py={4}>
                    No suggested users available at the moment.
                </Text>
            )}
        </Box>
    );
};

export default SuggestedUsers;
