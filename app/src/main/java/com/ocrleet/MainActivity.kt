package com.ocrleet

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val statusText = findViewById<TextView>(R.id.statusText)
        val imageView = findViewById<ImageView>(R.id.sharedImage)
        val ocrOutput = findViewById<TextView>(R.id.ocrOutput)

        if (intent?.action == Intent.ACTION_SEND && intent.type?.startsWith("image/") == true) {
            val imageUri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            if (imageUri != null) {
                handleSharedImage(imageUri, imageView, statusText, ocrOutput)
            } else {
                statusText.text = getString(R.string.status_error)
            }
        } else {
            statusText.text = getString(R.string.status_waiting)
        }
    }

    private fun handleSharedImage(
        uri: Uri,
        imageView: ImageView,
        statusText: TextView,
        ocrOutput: TextView
    ) {
        try {
            val bitmap = contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream)
            }
            if (bitmap != null) {
                imageView.setImageBitmap(bitmap)
                statusText.text = getString(R.string.status_ocr_running)
                runOcr(bitmap, statusText, ocrOutput)
            } else {
                statusText.text = getString(R.string.status_error)
            }
        } catch (e: Exception) {
            statusText.text = getString(R.string.status_error)
        }
    }

    private fun runOcr(bitmap: Bitmap, statusText: TextView, ocrOutput: TextView) {
        val inputImage = InputImage.fromBitmap(bitmap, 0)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

        recognizer.process(inputImage)
            .addOnSuccessListener { result ->
                val lines = result.textBlocks.flatMap { block ->
                    block.lines.map { line -> line.text }
                }
                ocrOutput.text = lines.joinToString("\n")
                statusText.text = getString(R.string.status_ocr_done, lines.size)
            }
            .addOnFailureListener {
                statusText.text = getString(R.string.status_ocr_failed)
            }
    }
}
