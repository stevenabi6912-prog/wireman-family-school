// Fills each Names-of-God week's memory item with its verse text (KJV —
// public domain; the family's version of choice). NEVER overwrites text
// Abi has already entered via the recite-screen editor.
// Capstone weeks (18, 36) review earlier verses, so they get no new text.
// Run: GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node scripts/seed-kjv-verses.js

import admin from 'firebase-admin';

admin.initializeApp({ projectId: 'wireman-homeschool' });
const db = admin.firestore();

const KJV = {
  1: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe. (Prov. 18:10, KJV)',
  2: 'In the beginning God created the heaven and the earth. (Gen. 1:1, KJV)',
  3: 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty. (Ps. 91:1, KJV)',
  4: 'And she called the name of the LORD that spake unto her, Thou God seest me. (Gen. 16:13, KJV)',
  5: 'I am the Almighty God; walk before me, and be thou perfect. (Gen. 17:1, KJV)',
  6: 'Before the mountains were brought forth, or ever thou hadst formed the earth and the world, even from everlasting to everlasting, thou art God. (Ps. 90:2, KJV)',
  7: 'Also I heard the voice of the Lord, saying, Whom shall I send, and who will go for us? Then said I, Here am I; send me. (Isa. 6:8, KJV)',
  8: 'And God said unto Moses, I AM THAT I AM: and he said, Thus shalt thou say unto the children of Israel, I AM hath sent me unto you. (Ex. 3:14, KJV)',
  9: 'And Abraham called the name of that place Jehovahjireh: as it is said to this day, In the mount of the LORD it shall be seen. (Gen. 22:14, KJV)',
  10: 'For I am the LORD that healeth thee. (Ex. 15:26, KJV)',
  11: 'And Moses built an altar, and called the name of it Jehovahnissi. (Ex. 17:15, KJV)',
  12: 'Sanctify yourselves therefore, and be ye holy: for I am the LORD your God. (Lev. 20:7, KJV)',
  13: 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee. (Isa. 26:3, KJV)',
  14: 'The LORD of hosts is with us; the God of Jacob is our refuge. (Ps. 46:7, KJV)',
  15: 'The LORD is my shepherd; I shall not want. (Ps. 23:1, KJV — whole psalm due Week 18)',
  16: 'In his days Judah shall be saved, and Israel shall dwell safely: and this is his name whereby he shall be called, THE LORD OUR RIGHTEOUSNESS. (Jer. 23:6, KJV)',
  17: 'And the name of the city from that day shall be, The LORD is there. (Ezek. 48:35, KJV)',
  19: 'In the beginning was the Word, and the Word was with God, and the Word was God. … And the Word was made flesh, and dwelt among us. (John 1:1, 14, KJV)',
  20: 'And she shall bring forth a son, and thou shalt call his name JESUS: for he shall save his people from their sins. (Matt. 1:21, KJV)',
  21: 'For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace. (Isa. 9:6, KJV)',
  22: 'And Simon Peter answered and said, Thou art the Christ, the Son of the living God. (Matt. 16:16, KJV)',
  23: 'Wherefore God also hath highly exalted him, and given him a name which is above every name: that at the name of Jesus every knee should bow… and that every tongue should confess that Jesus Christ is Lord, to the glory of God the Father. (Phil. 2:9-11, KJV)',
  24: 'And Thomas answered and said unto him, My Lord and my God. (John 20:28, KJV)',
  25: 'Who being the brightness of his glory, and the express image of his person, and upholding all things by the word of his power. (Heb. 1:3, KJV)',
  26: 'I saw in the night visions, and, behold, one like the Son of man came with the clouds of heaven… his dominion is an everlasting dominion, which shall not pass away. (Dan. 7:13-14, KJV)',
  27: 'Behold the Lamb of God, which taketh away the sin of the world. (John 1:29, KJV)',
  28: 'Let us therefore come boldly unto the throne of grace, that we may obtain mercy, and find grace to help in time of need. (Heb. 4:16, KJV)',
  29: 'And Jesus said unto them, I am the bread of life: he that cometh to me shall never hunger; and he that believeth on me shall never thirst. (John 6:35, KJV)',
  30: 'I am the good shepherd: the good shepherd giveth his life for the sheep. (John 10:11, KJV)',
  31: 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me. (John 14:6, KJV)',
  32: 'For ye have not received the spirit of bondage again to fear; but ye have received the Spirit of adoption, whereby we cry, Abba, Father. (Rom. 8:15, KJV)',
  33: 'And I will pray the Father, and he shall give you another Comforter, that he may abide with you for ever. (John 14:16, KJV)',
  34: 'I am Alpha and Omega, the beginning and the ending, saith the Lord, which is, and which was, and which is to come, the Almighty. (Rev. 1:8, KJV)',
  35: 'And he hath on his vesture and on his thigh a name written, KING OF KINGS, AND LORD OF LORDS. (Rev. 19:16, KJV)',
};

async function main() {
  const snap = await db.collection('memoryItems').where('track', '==', 'bible').get();
  let set = 0;
  let kept = 0;
  for (const d of snap.docs) {
    const m = d.data();
    const verse = KJV[m.week];
    if (!verse) continue;
    if (m.text && m.text.trim()) { kept++; continue; } // Abi's wording wins
    await d.ref.update({ text: verse, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    set++;
  }
  console.log(`KJV verse texts set: ${set}, left alone (Abi already wrote them): ${kept}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
