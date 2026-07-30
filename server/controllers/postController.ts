import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddlerware.js"; // ✅ Fixed import path
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { Generation } from "../models/Generation.js";
import { Post } from "../models/Post.js";
import { cloudinary } from "../config/cloudinary.js";

// ============================================
// POLL LEONARDO JOB
// ============================================
const pollLeonardoJob = async (
  generationId: string,
  apiKey: string,
): Promise<string> => {
  const maxRetries = 20;
  const delay = 5000;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(
        `https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`,
        {
          headers: {
            accept: "application/json",
            authorization: `Bearer ${apiKey}`,
          },
        },
      );

      const generation = response.data.generations_by_pk;
      if (generation.status === "COMPLETE") {
        if (
          generation.generated_images &&
          generation.generated_images.length > 0
        ) {
          return generation.generated_images[0].url;
        }
        throw new Error("generation complete but no image found");
      }
      if (generation.status === "FAILED") {
        throw new Error("Leonardo.ai generation failed");
      }
    } catch (err: any) {
      console.error("polling error:", err?.response?.data || err.message);
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error("Image generation timed out after max retries");
};

// ============================================
// GENERATE POST (AI)
// POST /api/posts/generate
// ============================================
export const generatePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔵 [GENERATE POST] Starting...");
    console.log("🔵 [GENERATE POST] User:", req.user?._id);
    console.log("🔵 [GENERATE POST] Prompt:", req.body.prompt);

    const { prompt, tone, generateImage } = req.body;

    if (!prompt) {
      res.status(400).json({ message: "Prompt is required" });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(400).json({
        message:
          "Gemini API Key is missing. Please add it to your server/.env file.",
      });
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    // Generate Text
    console.log("🔵 [GENERATE POST] Calling Gemini API...");
    const textResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a social media post based on this prompt: "${prompt}".
Tone: ${tone || "professional"}.
Include relevant hashtags.
Format the response as JSON with "content" and "imagePrompt" fields.
The "imagePrompt" should be a highly descriptive prompt for an image generator that complements the post.`,
    });

    let content = "";
    let imagePrompt = prompt;
    try {
      const rawText = textResponse.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
      const data = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { content: rawText, imagePrompt: prompt };
      content = data.content || rawText;
      imagePrompt = data.imagePrompt || prompt;
    } catch (e) {
      content = textResponse.text || "";
    }

    console.log(
      `✅ [GENERATE POST] Content generated: ${content.substring(0, 50)}...`,
    );

    let mediaUrl = "";
    if (generateImage) {
      try {
        const leonardoKey = process.env.LEONARDO_API_KEY;
        if (leonardoKey) {
          console.log("🔵 [GENERATE POST] Generating image with Leonardo...");
          const leoResponse = await axios.post(
            "https://cloud.leonardo.ai/api/rest/v2/generations",
            {
              public: false,
              model: "gpt-image-2",
              parameters: {
                quality: "LOW",
                prompt: imagePrompt,
                quantity: 1,
                width: 1024,
                height: 1024,
                prompt_enhance: "OFF",
              },
            },
            {
              headers: {
                accept: "application/json",
                authorization: `Bearer ${leonardoKey}`,
                "content-type": "application/json",
              },
            },
          );

          const generationId = leoResponse.data.generate.generationId;
          const tempUrl = await pollLeonardoJob(generationId, leonardoKey);

          // Upload to Cloudinary for persistence
          if (tempUrl) {
            const uploadResult = await cloudinary.uploader.upload(tempUrl, {
              folder: "ai-generations",
            });
            mediaUrl = uploadResult.secure_url;
            console.log(`✅ [GENERATE POST] Image uploaded: ${mediaUrl}`);
          }
        } else {
          console.warn("⚠️ [GENERATE POST] LEONARDO_API_KEY not configured");
        }
      } catch (error: any) {
        console.error(
          "❌ [GENERATE POST] Image generation failed:",
          error.message,
        );
      }
    }

    // Save generation to DB
    const generation = await Generation.create({
      user: req.user._id,
      prompt,
      content,
      mediaUrl,
      mediaType: mediaUrl ? "image" : undefined,
      tone: tone || "professional",
    });

    console.log(`✅ [GENERATE POST] Generation saved: ${generation._id}`);
    res.json(generation);
  } catch (error: any) {
    console.error("❌ [GENERATE POST] Error:", error.message);
    console.error("❌ [GENERATE POST] Stack:", error.stack);
    res.status(500).json({
      message: error?.message || "Server error",
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
  }
};

// ============================================
// GET GENERATIONS
// GET /api/posts/generations
// ============================================
export const getGenerations = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔵 [GET GENERATIONS] Fetching for user:", req.user?._id);

    if (!req.user || !req.user._id) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const generations = await Generation.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    console.log(`✅ [GET GENERATIONS] Found ${generations.length} generations`);
    res.json(generations);
  } catch (error: any) {
    console.error("❌ [GET GENERATIONS] Error:", error.message);
    res.status(500).json({ message: error?.message || "Server error" });
  }
};

// ============================================
// GET POSTS
// GET /api/posts
// ============================================
export const getPosts = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔵 [GET POSTS] Fetching for user:", req.user?._id);

    if (!req.user || !req.user._id) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const posts = await Post.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    console.log(`✅ [GET POSTS] Found ${posts.length} posts`);
    res.json(posts);
  } catch (error: any) {
    console.error("❌ [GET POSTS] Error:", error.message);
    res.status(500).json({ message: error?.message || "Server error" });
  }
};

// ============================================
// SCHEDULE POST
// POST /api/posts
// ============================================
export const schedulePost = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("🔵 [SCHEDULE POST] ===== STARTING =====");
    console.log("🔵 [SCHEDULE POST] User:", req.user?._id);
    console.log(
      "🔵 [SCHEDULE POST] Content type:",
      req.headers["content-type"],
    );
    console.log("🔵 [SCHEDULE POST] Has file:", !!req.file);

    if (!req.user || !req.user._id) {
      console.log("🔴 [SCHEDULE POST] No user found!");
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    const { content, platforms, scheduledFor, status } = req.body;

    // ✅ Validate required fields
    if (!content) {
      console.log("🔴 [SCHEDULE POST] Missing content");
      res.status(400).json({ message: "Content is required" });
      return;
    }

    if (!platforms) {
      console.log("🔴 [SCHEDULE POST] Missing platforms");
      res.status(400).json({ message: "Platforms are required" });
      return;
    }

    // ✅ Parse platforms (handles both JSON string and array)
    let parsedPlatforms = platforms;
    if (typeof platforms === "string") {
      try {
        parsedPlatforms = JSON.parse(platforms);
        console.log(
          "✅ [SCHEDULE POST] Parsed platforms from JSON:",
          parsedPlatforms,
        );
      } catch (e) {
        console.log(
          "⚠️ [SCHEDULE POST] Failed to parse as JSON, splitting by comma",
        );
        parsedPlatforms = platforms.split(",").map((p: string) => p.trim());
      }
    }

    // ✅ Ensure platforms is an array
    if (!Array.isArray(parsedPlatforms)) {
      console.log("⚠️ [SCHEDULE POST] Platforms is not an array, converting");
      parsedPlatforms = [parsedPlatforms];
    }

    console.log("🔵 [SCHEDULE POST] Final platforms:", parsedPlatforms);

    // ✅ Handle media upload
    let mediaUrl: string | undefined = undefined;
    let mediaType: "image" | "video" | undefined = undefined;

    if (req.file) {
      try {
        console.log("🔵 [SCHEDULE POST] Uploading file to Cloudinary...");
        const result = await new Promise<any>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: "auto",
              folder: "social-scheduler",
            },
            (error, result) => {
              if (error) {
                console.error("🔴 [SCHEDULE POST] Cloudinary error:", error);
                reject(error);
              } else {
                resolve(result);
              }
            },
          );
          stream.end(req.file!.buffer);
        });

        mediaUrl = result.secure_url;
        mediaType = result.resource_type === "video" ? "video" : "image";
        console.log(
          `✅ [SCHEDULE POST] File uploaded: ${mediaUrl} (${mediaType})`,
        );
      } catch (uploadError: any) {
        console.error(
          "🔴 [SCHEDULE POST] File upload failed:",
          uploadError.message,
        );
        // Continue without media
      }
    }

    // ✅ Create post
    const postData = {
      user: req.user._id,
      content,
      platforms: parsedPlatforms,
      mediaUrl,
      mediaType,
      scheduledFor: scheduledFor || new Date().toISOString(),
      status: status || "pending",
    };

    console.log(
      "🔵 [SCHEDULE POST] Creating post with data:",
      JSON.stringify(postData, null, 2),
    );

    const post = await Post.create(postData);

    console.log(`✅ [SCHEDULE POST] Post created: ${post._id}`);
    res.status(201).json(post);
  } catch (error: any) {
    console.error("🔴 [SCHEDULE POST] ===== ERROR =====");
    console.error("🔴 [SCHEDULE POST] Message:", error.message);
    console.error("🔴 [SCHEDULE POST] Stack:", error.stack);

    res.status(500).json({
      message: error?.message || "Server error",
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    });
  }
};
