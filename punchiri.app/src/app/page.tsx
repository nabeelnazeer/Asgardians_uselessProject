"use client";
import React, { useRef, useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Camera, Download, History, Home, Info, Settings } from "lucide-react";

export default function EnhancedSmileDetector() {
  // ... (previous state and ref declarations remain the same)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [history, setHistory] = useState<number[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        console.error("Error loading models:", error);
      }
    };

    loadModels();
    startVideo();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
    }
  };

  const calculateSmileScore = (detection: any) => {
    const mouth = detection.landmarks.getMouth();
    const box = detection.detection.box;

    // Calculate mouth width
    const mouthWidth = Math.abs(mouth[0].x - mouth[6].x);

    // Calculate mouth height (from center top to center bottom)
    const mouthHeight = Math.abs(mouth[3].y - mouth[9].y);

    // Calculate mouth curvature
    const mouthTop = mouth[3].y;
    const mouthCorners = (mouth[0].y + mouth[6].y) / 2;
    const curvature = mouthCorners - mouthTop; // Inverted for more intuitive scoring

    // Normalize the score based on face size
    const faceWidth = box.width;
    const normalizedCurvature = (curvature / faceWidth) * 100;
    const normalizedWidth = (mouthWidth / faceWidth) * 100;

    // Calculate final score (0-100)
    // Weight the curvature more heavily in the score
    const smileScore = Math.min(
      Math.max(
        Math.round(
          (normalizedCurvature * 0.7 + normalizedWidth * 0.3) * 2 + 50
        ),
        0
      ),
      100
    );

    return smileScore;
  };

  const handlePlay = () => {
    if (!modelsLoaded) return;

    setIsDetecting(true);
    const interval = setInterval(async () => {
      if (!canvasRef.current || !videoRef.current) return;

      const detections = await faceapi
        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      const displaySize = {
        width: videoRef.current.width,
        height: videoRef.current.height,
      };

      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      // Clear previous drawings
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      resizedDetections.forEach((detection) => {
        // Draw face box
        const box = detection.detection.box;
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Draw mouth landmarks
        const mouth = detection.landmarks.getMouth();
        ctx.beginPath();
        ctx.moveTo(mouth[0].x, mouth[0].y);

        // Draw upper lip
        ctx.moveTo(mouth[0].x, mouth[0].y);
        for (let i = 1; i <= 6; i++) {
          ctx.lineTo(mouth[i].x, mouth[i].y);
        }

        // Draw lower lip
        ctx.moveTo(mouth[6].x, mouth[6].y);
        for (let i = 7; i <= 11; i++) {
          ctx.lineTo(mouth[i].x, mouth[i].y);
        }
        ctx.lineTo(mouth[0].x, mouth[0].y);

        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Calculate and update smile score
        const newScore = calculateSmileScore(detection);
        setScore(newScore);

        // Add expression text
        ctx.fillStyle = "#00ff00";
        ctx.font = "16px Arial";
        Object.entries(detection.expressions).forEach(
          ([expression, probability], index) => {
            const text = `${expression}: ${(probability as number).toFixed(2)}`;
            ctx.fillText(text, box.x, box.y - 10 - index * 20);
          }
        );
      });
    }, 100);

    return () => clearInterval(interval);
  };

  const handleStopDetection = () => {
    setIsDetecting(false);
    setHistory((prev) => [...prev, score]);
  };

  const handleTakePhoto = () => {
    if (canvasRef.current) {
      const link = document.createElement("a");
      link.download = "smile-detector-photo.png";
      link.href = canvasRef.current.toDataURL();
      link.click();
    }
  };

  const handleBrightnessChange = (value: number[]) => {
    setBrightness(value[0]);
    if (videoRef.current) {
      videoRef.current.style.filter = `brightness(${value[0]}%)`;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <nav className="container mx-auto px-6 py-3">
          <ul className="flex space-x-4">
            <li>
              <Button variant="ghost">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </li>
            <li>
              <Button variant="ghost">
                <Info className="mr-2 h-4 w-4" />
                About
              </Button>
            </li>
            <li>
              <Button variant="ghost">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </li>
          </ul>
        </nav>
      </header>

      <main className="flex-grow container mx-auto px-6 py-8">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Enhanced Smile Detector
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Webcam Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <video
                  ref={videoRef}
                  width="640"
                  height="480"
                  autoPlay
                  muted
                  onPlay={handlePlay}
                  className="rounded-lg shadow-lg"
                />
                <canvas
                  ref={canvasRef}
                  width="640"
                  height="480"
                  className="absolute top-0 left-0"
                />
              </div>
              <div className="mt-4 space-y-4">
                <div className="flex justify-between">
                  <Button
                    onClick={isDetecting ? handleStopDetection : handlePlay}
                    disabled={!modelsLoaded}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {isDetecting ? "Stop Detection" : "Start Detection"}
                  </Button>
                  <Button onClick={handleTakePhoto}>
                    <Download className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                </div>
                <div>
                  <Label htmlFor="brightness">Brightness</Label>
                  <Slider
                    id="brightness"
                    min={50}
                    max={150}
                    step={1}
                    value={[brightness]}
                    onValueChange={handleBrightnessChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smile Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-6xl font-bold text-center mb-4">{score}</div>
              <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
                Your current smile score
              </p>
              <Card>
                <CardHeader>
                  <CardTitle>Score History</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {history.map((historyScore, index) => (
                      <li
                        key={index}
                        className="flex justify-between items-center"
                      >
                        <span>Attempt {index + 1}</span>
                        <span className="font-semibold">{historyScore}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 shadow-md mt-8">
        <div className="container mx-auto px-6 py-3 text-center">
          <p>&copy; 2024 Enhanced Smile Detector. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
