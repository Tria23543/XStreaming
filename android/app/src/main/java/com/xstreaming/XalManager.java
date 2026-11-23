package com.xstreaming;

import android.util.Log;

import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;

import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import java.math.BigInteger;
import java.io.ByteArrayOutputStream;
import com.google.common.primitives.Longs;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

public class XalManager extends ReactContextBaseJavaModule {

    private static final KeyPairGenerator KEY_PAIR_GEN;

    static {
        try {
            KEY_PAIR_GEN = KeyPairGenerator.getInstance("EC");
            KEY_PAIR_GEN.initialize(new ECGenParameterSpec("secp256r1")); //use P-256
        } catch (Exception e) {
            throw new AssertionError("Unable to initialize required encryption", e);
        }
    }

    private static KeyPair createKeyPair() {
        return KEY_PAIR_GEN.generateKeyPair();
    }

    private static byte[] bigIntegerToByteArray(BigInteger bigInteger) {
        byte[] array = bigInteger.toByteArray();
        if (array.length == 32) {
            return array;
        }
        // A JWK coordinate must be exactly 32 bytes. The two's-complement
        // form is 33 bytes when a leading sign byte is present (drop all
        // but the last 32) and can be SHORTER than 32 when the coordinate
        // itself has leading zero bytes — the old code returned those
        // short arrays unchanged, producing a malformed proof key and an
        // intermittent device-auth failure. Left-pad to 32 instead.
        byte[] result = new byte[32];
        if (array.length > 32) {
            System.arraycopy(array, array.length - 32, result, 0, 32);
        } else {
            System.arraycopy(array, 0, result, 32 - array.length, array.length);
        }
        return result;
    }

    private String getProofKeyX(ECPublicKey ecPublicKey) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bigIntegerToByteArray(ecPublicKey.getW().getAffineX()));
    }

    private String getProofKeyY(ECPublicKey ecPublicKey) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bigIntegerToByteArray(ecPublicKey.getW().getAffineY()));
    }

    // windowsTimestamp returns a Windows specific timestamp. It has a certain offset from Unix time which must be accounted for.
    private long windowsTimestamp() {
        return (Instant.now().getEpochSecond() + 11644473600L) * 10000000L;
    }

    private ECPublicKey publicKey;
    private ECPrivateKey privateKey;

    XalManager(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "XalManager";
    }

    @ReactMethod(isBlockingSynchronousMethod=true)
    public void init() {
        KeyPair ecdsa256KeyPair = createKeyPair();
        ECPublicKey publicKey = (ECPublicKey) ecdsa256KeyPair.getPublic();
        ECPrivateKey privateKey = (ECPrivateKey) ecdsa256KeyPair.getPrivate();

        this.publicKey = publicKey;
        this.privateKey = privateKey;
    }

    @ReactMethod(isBlockingSynchronousMethod=true)
    public String nextUUID() {
        return UUID.randomUUID().toString();
    }

    @ReactMethod(isBlockingSynchronousMethod=true)
    public String getKeyX() {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bigIntegerToByteArray(this.publicKey.getW().getAffineX()));
    }

    @ReactMethod(isBlockingSynchronousMethod=true)
    public String getKeyY() {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bigIntegerToByteArray(this.publicKey.getW().getAffineY()));
    }

    @ReactMethod(isBlockingSynchronousMethod=true)
    public String sign(String url, String authorizationToken, String postData) throws Exception {
//        Log.d("XalManager", "postData:" + postData);

        String result = "";

        long currentTime = this.windowsTimestamp();
        ByteArrayOutputStream bytesToSign = new ByteArrayOutputStream();

        bytesToSign.write(new byte[] { 0, 0, 0, 1, 0 });
        bytesToSign.write(Longs.toByteArray(currentTime));
        bytesToSign.write(new byte[] { 0 });

        bytesToSign.write("POST".getBytes());
        bytesToSign.write(new byte[] { 0 });

        URL _url = new URL(url);

        // if url = https://device.auth.xboxlive.com/device/authenticate
        // pathAndQuery = /device/authenticate
        String pathAndQuery = _url.getPath();


        if (pathAndQuery == null) {
            pathAndQuery = "";
        }

        bytesToSign.write((_url.getPath()).getBytes());
        bytesToSign.write(new byte[] { 0 });

        bytesToSign.write(authorizationToken.getBytes());
        bytesToSign.write(new byte[] { 0 });

        // Sign the exact body bytes the app sends, byte for byte — the
        // same contract the iOS implementation uses. This code previously
        // re-serialised the JSON through Gson before signing; any byte
        // difference between the re-serialised form and the body actually
        // posted makes the server reject the signature.
        bytesToSign.write(postData.getBytes(StandardCharsets.UTF_8));
        bytesToSign.write(new byte[] { 0 });

        Signature signature = Signature.getInstance("SHA256withECDSA");
        signature.initSign(this.privateKey);
        signature.update(bytesToSign.toByteArray());
        byte[] signatureBytes = JoseStuff.DERToJOSE(signature.sign(), JoseStuff.AlgorithmType.ECDSA256);

        ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
        byteArrayOutputStream.write(new byte[] { 0, 0, 0, 1 });
        byteArrayOutputStream.write(Longs.toByteArray(currentTime));
        byteArrayOutputStream.write(signatureBytes);

        result = Base64.getEncoder().encodeToString(byteArrayOutputStream.toByteArray());

        return result;
    }

    @ReactMethod(isBlockingSynchronousMethod=true)
    public WritableMap getCodeChallange() {
        // 生成一个长度为32字节的伪随机字节序列
        byte[] randomBytes = new byte[32];
        new SecureRandom().nextBytes(randomBytes);

        // 将随机字节序列转换为base64编码
        String codeVerifier = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        // 使用SHA-256哈希算法对codeVerifier进行哈希运算
        byte[] codeVerifierBytes = codeVerifier.getBytes();
        byte[] codeChallenge = null;
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            codeChallenge = digest.digest(codeVerifierBytes);
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
        }

        // 将结果转换为base64编码
        String codeChallengeBase64 = Base64.getUrlEncoder().withoutPadding().encodeToString(codeChallenge);

//        Log.d("XalManager", "code_verifier: " + codeVerifier);
//        Log.d("XalManager", "code_challenge: " + codeChallengeBase64);

        WritableMap map = Arguments.createMap();

        map.putString("value", codeChallengeBase64);
        map.putString("method", "S256");
        map.putString("verifier", codeVerifier);

        return map;
    }

    @ReactMethod(isBlockingSynchronousMethod=true)
    public String getRandomState() {
        int bytes = 64;
        byte[] randomBytes = new byte[bytes];
        new SecureRandom().nextBytes(randomBytes);
        String base64Url = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
        return base64Url;
    }
}
