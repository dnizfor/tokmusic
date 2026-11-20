import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from './ui';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  text: string;
  steps?: string[];
};

const SLIDES: Slide[] = [
  {
    icon: 'musical-notes',
    color: C.pink,
    title: 'Welcome to Tok Music',
    text: 'Save the sounds you love from TikTok and play them on loop — offline, in the background, without the video.',
  },
  {
    icon: 'share-social',
    color: C.cyan,
    title: 'Share from TikTok',
    text: 'Found a sound you like? Send it here straight from TikTok.',
    steps: [
      'Open the video in TikTok',
      'Tap Share (the arrow icon)',
      'Tap More / Other apps',
      'Choose Tok Music',
    ],
  },
  {
    icon: 'create',
    color: C.pink,
    title: 'Name it, pick a playlist',
    text:
      'Before downloading you can rename the sound and add it to playlists. If TikTok says the sound contains a song, we show it and use it as the name.',
  },
  {
    icon: 'repeat',
    color: C.cyan,
    title: 'Loop or play the list',
    text:
      'Tap the repeat button to switch between looping one sound and playing the whole playlist. Tap ⋯ on a sound to rename it, add it to a playlist or delete it. Long-press a playlist to edit it.',
  },
];

export function Onboarding({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const ref = useRef<ScrollViewInstance>(null);
  const last = index === SLIDES.length - 1;

  const goTo = (i: number) => {
    ref.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  const finish = () => {
    onDone();
    setTimeout(() => {
      setIndex(0);
      ref.current?.scrollTo({ x: 0, animated: false });
    }, 400);
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={finish} statusBarTranslucent>
      <SafeAreaView style={st.root} edges={['top', 'bottom']}>
        <View style={st.top}>
          {!last ? (
            <Pressable onPress={finish} hitSlop={12}>
              <Text style={st.skip}>Skip</Text>
            </Pressable>
          ) : (
            <View />
          )}
        </View>

        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={{ flex: 1 }}
        >
          {SLIDES.map((sl, i) => (
            <View key={i} style={[st.slide, { width }]}>
              <View style={[st.iconWrap, { borderColor: sl.color }]}>
                <Ionicons name={sl.icon} size={56} color={sl.color} />
              </View>
              <Text style={st.title}>{sl.title}</Text>
              <Text style={st.text}>{sl.text}</Text>
              {sl.steps && (
                <View style={st.steps}>
                  {sl.steps.map((step, n) => (
                    <View key={n} style={st.step}>
                      <View style={st.stepNum}>
                        <Text style={st.stepNumText}>{n + 1}</Text>
                      </View>
                      <Text style={st.stepText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={st.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[st.dot, i === index && st.dotActive]} />
          ))}
        </View>

        <Pressable style={st.btn} onPress={() => (last ? finish() : goTo(index + 1))}>
          <Text style={st.btnText}>{last ? 'Get started' : 'Next'}</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { height: 48, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 22 },
  skip: { color: C.dim, fontSize: 15, fontWeight: '600' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  iconWrap: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, marginBottom: 12 },
  title: { color: C.text, fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  text: { color: C.dim, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  steps: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 12, padding: 12 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  stepText: { color: C.text, fontSize: 15, flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.line },
  dotActive: { width: 22, backgroundColor: C.pink },
  btn: { marginHorizontal: 24, marginBottom: 16, height: 54, borderRadius: 27, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
