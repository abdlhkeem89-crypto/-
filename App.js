import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { I18nManager } from 'react-native';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const APP_NAME = 'تطبيق عبد الحكيم محمد للدراسة';
const STORAGE_KEY = '@abdulhakim_study_app_v1';
const SUBJECTS = [
  'القرآن الكريم',
  'التربية الإسلامية',
  'اللغة العربية',
  'اللغة الإنجليزية',
  'الرياضيات',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'التاريخ',
  'الجغرافيا',
  'المجتمع',
  'الحاسوب',
];
const WEEK_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
const TABS = [
  { key: 'today', label: 'اليوم', icon: '✍️' },
  { key: 'archive', label: 'الأرشيف', icon: '🗂️' },
  { key: 'schedule', label: 'الجدول', icon: '📅' },
  { key: 'pending', label: 'الناقصة', icon: '⏳' },
  { key: 'homework', label: 'الواجبات', icon: '📝' },
  { key: 'tests', label: 'الاختبارات', icon: '🎯' },
  { key: 'subjects', label: 'المواد', icon: '📚' },
];

const emptyData = {
  lessons: [],
  schedule: WEEK_DAYS.reduce((acc, day) => ({ ...acc, [day]: [] }), {}),
  pending: [],
  homework: [],
  tests: [],
  subjectLessons: [],
  settings: { notifications: true },
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatDate = (value) => {
  if (!value) return 'بدون تاريخ';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ar-YE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};
const dateTimeLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('ar-YE', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function App() {
  const [data, setData] = useState(emptyData);
  const [activeTab, setActiveTab] = useState('today');
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(SUBJECTS[0]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setData({ ...emptyData, ...JSON.parse(saved) });
      } catch (error) {
        Alert.alert('تنبيه', 'تعذر قراءة البيانات المحفوظة.');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
  }, [data, ready]);

  useEffect(() => {
    if (!ready || !data.settings.notifications) return;
    setupNotifications();
  }, [ready, data.settings.notifications]);

  const setupNotifications = async () => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      if (!permissions.granted) {
        const requested = await Notifications.requestPermissionsAsync();
        if (!requested.granted) return;
      }
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: { title: 'تذكير الدراسة', body: 'حان وقت إضافة ما درسته اليوم إلى سجلك.', sound: true },
        trigger: { hour: 19, minute: 0, repeats: true },
      });
      await Notifications.scheduleNotificationAsync({
        content: { title: 'مراجعة الدروس الناقصة', body: 'راجع الدروس الناقصة والمتأخرة حتى لا تتراكم عليك.', sound: true },
        trigger: { weekday: 6, hour: 17, minute: 0, repeats: true },
      });
      await Notifications.scheduleNotificationAsync({
        content: { title: 'تذكير الواجبات', body: 'تحقق من واجباتك ومواعيد التسليم.', sound: true },
        trigger: { hour: 16, minute: 30, repeats: true },
      });
    } catch (error) {
      // قد لا تعمل الإشعارات في Expo Go على بعض المنصات، لكن التطبيق يستمر بشكل طبيعي.
    }
  };

  const updateData = (patch) => setData((previous) => ({ ...previous, ...patch }));
  const addItem = (key, item) => updateData({ [key]: [...data[key], { ...item, id: makeId(), createdAt: new Date().toISOString() }] });
  const removeItem = (key, id) => updateData({ [key]: data[key].filter((item) => item.id !== id) });
  const toggleItem = (key, id, field = 'completed') => updateData({ [key]: data[key].map((item) => item.id === id ? { ...item, [field]: !item[field] } : item) });
  const confirmDelete = (key, id, title = 'العنصر') => Alert.alert('تأكيد الحذف', `هل تريد حذف ${title}؟`, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => removeItem(key, id) }]);

  const openAdd = (type, extra = {}) => {
    if (type === 'schedule') {
      setModal({ type, ...extra, onSchedule: (item) => updateData({ schedule: { ...data.schedule, [extra.day]: [...(data.schedule[extra.day] || []), item] } }) });
      return;
    }
    if (type === 'subjectView') {
      setModal({ type, ...extra, items: data.subjectLessons.filter((item) => item.subject === extra.subject) });
      return;
    }
    setModal({ type, ...extra });
  };
  const closeModal = () => setModal(null);

  const chooseImage = async (mode, onPicked) => {
    try {
      const permission = mode === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('الصلاحية مطلوبة', 'اسمح للتطبيق بالوصول إلى الصور أو الكاميرا من إعدادات الهاتف.');
        return;
      }
      const result = mode === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled && result.assets?.[0]?.uri) onPicked(result.assets[0].uri);
    } catch (error) {
      Alert.alert('خطأ', 'تعذر اختيار الصورة.');
    }
  };

  const saveModal = (payload) => {
    if (!payload) return;
    if (modal.type === 'lesson') addItem('lessons', payload);
    if (modal.type === 'pending') addItem('pending', payload);
    if (modal.type === 'homework') addItem('homework', payload);
    if (modal.type === 'test') addItem('tests', payload);
    if (modal.type === 'subjectLesson') addItem('subjectLessons', payload);
    if (modal.type === 'subjectView') addItem('subjectLessons', payload);
    closeModal();
    setNotice('تم الحفظ بنجاح');
    setTimeout(() => setNotice(''), 2200);
  };

  const counts = useMemo(() => ({
    lessons: data.lessons.length,
    pending: data.pending.filter((x) => !x.completed).length,
    homework: data.homework.filter((x) => !x.completed).length,
    tests: data.tests.filter((x) => !x.completed).length,
  }), [data]);

  if (!ready) return <SafeAreaView style={styles.loading}><Text style={styles.loadingText}>جارٍ تجهيز تطبيق عبد الحكيم محمد...</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#123c69" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>عبد الحكيم محمد</Text>
          <Text style={styles.headerSubtitle}>تطبيق متابعة الدراسة • الصف الأول الثانوي</Text>
        </View>
        <Pressable style={styles.bell} onPress={() => updateData({ settings: { ...data.settings, notifications: !data.settings.notifications } })}>
          <Text style={styles.bellText}>{data.settings.notifications ? '🔔' : '🔕'}</Text>
        </Pressable>
      </View>

      <View style={styles.content}>{renderScreen()}</View>
      {notice ? <View style={styles.toast}><Text style={styles.toastText}>{notice}</Text></View> : null}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((tab) => (
            <Pressable key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
              <Text style={styles.tabIcon}>{tab.icon}</Text><Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <EntryModal modal={modal} closeModal={closeModal} saveModal={saveModal} chooseImage={chooseImage} />
    </SafeAreaView>
  );

  function renderScreen() {
    if (activeTab === 'today') return <TodayScreen />;
    if (activeTab === 'archive') return <ArchiveScreen />;
    if (activeTab === 'schedule') return <ScheduleScreen />;
    if (activeTab === 'pending') return <PendingScreen />;
    if (activeTab === 'homework') return <HomeworkScreen />;
    if (activeTab === 'tests') return <TestsScreen />;
    return <SubjectsScreen />;
  }

  function Page({ title, subtitle, action, children }) {
    return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><View style={styles.pageHeading}><View style={{ flex: 1 }}><Text style={styles.pageTitle}>{title}</Text>{subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}</View>{action}</View>{children}</ScrollView>;
  }
  const AddButton = ({ onPress, label = 'إضافة' }) => <Pressable style={styles.primaryButton} onPress={onPress}><Text style={styles.primaryButtonText}>＋ {label}</Text></Pressable>;
  const Empty = ({ text }) => <View style={styles.empty}><Text style={styles.emptyIcon}>📖</Text><Text style={styles.emptyText}>{text}</Text></View>;
  const Chip = ({ children, color = '#e8f1fb' }) => <View style={[styles.chip, { backgroundColor: color }]}><Text style={styles.chipText}>{children}</Text></View>;

  function TodayScreen() {
    const todayLessons = data.lessons.filter((item) => item.date === todayISO()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return <Page title="سجل دروس اليوم" subtitle={formatDate(todayISO())} action={<AddButton onPress={() => openAdd('lesson')} label="تسجيل درس" />}>
      <View style={styles.statsRow}><View style={styles.stat}><Text style={styles.statNumber}>{todayLessons.length}</Text><Text style={styles.statLabel}>دروس اليوم</Text></View><View style={styles.stat}><Text style={styles.statNumber}>{counts.pending}</Text><Text style={styles.statLabel}>دروس ناقصة</Text></View><View style={styles.stat}><Text style={styles.statNumber}>{counts.homework}</Text><Text style={styles.statLabel}>واجبات مفتوحة</Text></View></View>
      {todayLessons.length ? todayLessons.map((item) => <LessonCard key={item.id} item={item} deleteAction={() => confirmDelete('lessons', item.id, 'الدرس')} />) : <Empty text="لم تسجل أي درس اليوم. ابدأ بإضافة ما درسته." />}
    </Page>;
  }

  function ArchiveScreen() {
    const grouped = [...data.lessons].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));
    return <Page title="أرشيف الدروس" subtitle="كل ما حفظته للمراجعة حسب اليوم والتاريخ" action={<AddButton onPress={() => openAdd('lesson', { archive: true })} label="إضافة درس" />}>
      {grouped.length ? grouped.map((item) => <LessonCard key={item.id} item={item} showDate deleteAction={() => confirmDelete('lessons', item.id, 'الدرس')} />) : <Empty text="الأرشيف فارغ حالياً." />}
    </Page>;
  }

  function LessonCard({ item, showDate, deleteAction }) {
    return <View style={styles.card}><View style={styles.cardTop}><Chip>{item.subject}</Chip><Pressable onPress={deleteAction}><Text style={styles.deleteText}>حذف</Text></Pressable></View><Text style={styles.cardTitle}>{item.title}</Text>{showDate || item.date !== todayISO() ? <Text style={styles.meta}>📅 {formatDate(item.date)}</Text> : null}{item.summary ? <Text style={styles.bodyText}>{item.summary}</Text> : null}{item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.lessonImage} /> : null}</View>;
  }

  function ScheduleScreen() {
    return <Page title="جدول الحصص الأسبوعي" subtitle="عدّل حصصك واحفظها محلياً على الهاتف"><Text style={styles.hint}>اضغط على إضافة حصة أمام اليوم، ويمكنك حذف أي حصة بالضغط على حذف.</Text>{WEEK_DAYS.map((day) => <View key={day} style={styles.dayBlock}><View style={styles.dayHeader}><Text style={styles.dayTitle}>{day}</Text><Pressable style={styles.smallButton} onPress={() => openAdd('schedule', { day })}><Text style={styles.smallButtonText}>＋ حصة</Text></Pressable></View>{data.schedule[day]?.length ? data.schedule[day].map((item) => <View style={styles.scheduleItem} key={item.id}><Text style={styles.scheduleText}>{item.period ? `${item.period} • ` : ''}{item.subject || 'حصة'}{item.teacher ? ` • ${item.teacher}` : ''}</Text><Pressable onPress={() => updateData({ schedule: { ...data.schedule, [day]: data.schedule[day].filter((x) => x.id !== item.id) } })}><Text style={styles.deleteText}>حذف</Text></Pressable></View>) : <Text style={styles.muted}>لا توجد حصص مضافة لهذا اليوم.</Text>}</View>)}</Page>;
  }

  function PendingScreen() {
    return <Page title="الدروس الناقصة / المتأخرة" subtitle="سجل ما فاتك وتابع إنجازه" action={<AddButton onPress={() => openAdd('pending')} label="درس ناقص" />}>
      {data.pending.length ? data.pending.sort((a, b) => Number(a.completed) - Number(b.completed)).map((item) => <View style={[styles.card, item.completed && styles.completedCard]} key={item.id}><View style={styles.cardTop}><Chip color={item.completed ? '#dff5e5' : '#fff0d8'}>{item.subject}</Chip><Pressable onPress={() => confirmDelete('pending', item.id, 'الدرس الناقص')}><Text style={styles.deleteText}>حذف</Text></Pressable></View><Text style={[styles.cardTitle, item.completed && styles.strike]}>{item.title}</Text><Text style={styles.meta}>📅 {item.day} • {formatDate(item.date)}</Text><Pressable style={styles.checkRow} onPress={() => toggleItem('pending', item.id)}><Text style={styles.checkbox}>{item.completed ? '☑' : '☐'}</Text><Text style={styles.checkText}>{item.completed ? 'تمت المراجعة / مكتمل' : 'تحديد كمكتمل'}</Text></Pressable></View>) : <Empty text="لا توجد دروس ناقصة. ممتاز!" />}
    </Page>;
  }

  function HomeworkScreen() {
    return <Page title="الواجبات المدرسية" subtitle="تابع الحل ومواعيد التسليم" action={<AddButton onPress={() => openAdd('homework')} label="واجب جديد" />}>
      {data.homework.length ? data.homework.sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate || '').localeCompare(b.dueDate || '')).map((item) => <View style={[styles.card, item.completed && styles.completedCard]} key={item.id}><View style={styles.cardTop}><Chip color="#f0e7fb">{item.subject}</Chip><Pressable onPress={() => confirmDelete('homework', item.id, 'الواجب')}><Text style={styles.deleteText}>حذف</Text></Pressable></View><Text style={[styles.cardTitle, item.completed && styles.strike]}>{item.details}</Text><Text style={styles.meta}>📅 موعد التسليم: {formatDate(item.dueDate)}</Text><Pressable style={styles.checkRow} onPress={() => toggleItem('homework', item.id)}><Text style={styles.checkbox}>{item.completed ? '☑' : '☐'}</Text><Text style={styles.checkText}>{item.completed ? 'تم الحل' : 'تحديد كتم الحل'}</Text></Pressable></View>) : <Empty text="لم تضف أي واجب بعد." />}
    </Page>;
  }

  function TestsScreen() {
    return <Page title="الاختبارات" subtitle="أضف الاختبارات مع اليوم والتاريخ واحذفها عند الحاجة" action={<AddButton onPress={() => openAdd('test')} label="اختبار جديد" />}>
      {data.tests.length ? data.tests.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((item) => <View style={[styles.card, item.completed && styles.completedCard]} key={item.id}><View style={styles.cardTop}><Chip color="#ffe5e5">{item.subject}</Chip><Pressable onPress={() => confirmDelete('tests', item.id, 'الاختبار')}><Text style={styles.deleteText}>حذف</Text></Pressable></View><Text style={[styles.cardTitle, item.completed && styles.strike]}>{item.title}</Text><Text style={styles.meta}>📅 {item.day} • {formatDate(item.date)}</Text>{item.notes ? <Text style={styles.bodyText}>{item.notes}</Text> : null}<Pressable style={styles.checkRow} onPress={() => toggleItem('tests', item.id)}><Text style={styles.checkbox}>{item.completed ? '☑' : '☐'}</Text><Text style={styles.checkText}>{item.completed ? 'تمت المراجعة' : 'تحديد كمراجع'}</Text></Pressable></View>) : <Empty text="أضف مواعيد اختباراتك هنا." />}
    </Page>;
  }

  function SubjectsScreen() {
    const subjectItems = SUBJECTS.map((subject) => ({ subject, count: data.subjectLessons.filter((x) => x.subject === subject).length }));
    return <Page title="دروس كل مادة" subtitle="اختر المادة لإضافة الدروس وتصفحها أثناء المذاكرة"><View style={styles.subjectGrid}>{subjectItems.map((item) => <Pressable key={item.subject} style={styles.subjectBox} onPress={() => openAdd('subjectView', { subject: item.subject })}><Text style={styles.subjectIcon}>📘</Text><Text style={styles.subjectName}>{item.subject}</Text><Text style={styles.subjectCount}>{item.count} درس</Text></Pressable>)}</View></Page>;
  }
}

function Field({ label, value, onChangeText, placeholder, multiline = false, keyboardType = 'default' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={[styles.input, multiline && styles.multiline]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9ba9b7" multiline={multiline} keyboardType={keyboardType} textAlign="right" /></View>;
}

function SubjectPicker({ value, onChange }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>المادة</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>{SUBJECTS.map((subject) => <Pressable key={subject} style={[styles.pill, value === subject && styles.pillActive]} onPress={() => onChange(subject)}><Text style={[styles.pillText, value === subject && styles.pillTextActive]}>{subject}</Text></Pressable>)}</ScrollView></View>;
}

function EntryModal({ modal, closeModal, saveModal, chooseImage }) {
  const [form, setForm] = useState({});
  const [addingSubjectLesson, setAddingSubjectLesson] = useState(false);
  useEffect(() => {
    if (!modal) return;
    setAddingSubjectLesson(false);
    const defaults = modal.type === 'lesson' ? { subject: SUBJECTS[0], title: '', summary: '', date: todayISO(), imageUri: '' }
      : modal.type === 'pending' ? { subject: SUBJECTS[0], title: '', day: 'الأحد', date: todayISO() }
      : modal.type === 'homework' ? { subject: SUBJECTS[0], details: '', dueDate: todayISO() }
      : modal.type === 'test' ? { subject: SUBJECTS[0], title: '', day: 'الأحد', date: todayISO(), notes: '' }
      : modal.type === 'schedule' ? { period: '', subject: SUBJECTS[0], teacher: '' }
      : { subject: modal.subject || SUBJECTS[0], title: '', summary: '' };
    setForm(defaults);
  }, [modal]);
  if (!modal) return null;

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = () => {
    const required = modal.type === 'homework' ? form.details : modal.type === 'schedule' ? form.subject : form.title;
    if (!required?.trim?.() && !required) return Alert.alert('بيانات ناقصة', 'أكمل البيانات المطلوبة أولاً.');
    if ((modal.type === 'lesson' || modal.type === 'pending' || modal.type === 'homework' || modal.type === 'test') && !/^\d{4}-\d{2}-\d{2}$/.test(modal.type === 'homework' ? form.dueDate : form.date)) return Alert.alert('التاريخ غير صحيح', 'اكتب التاريخ بهذا الشكل: 2026-10-04');
    if (modal.type === 'schedule') {
      const schedulePayload = { ...form, id: makeId() };
      modal.onSchedule?.(schedulePayload);
      closeModal();
      return;
    }
    saveModal({ ...form, completed: false });
  };

  const title = modal.type === 'lesson' ? 'تسجيل درس' : modal.type === 'pending' ? 'إضافة درس ناقص' : modal.type === 'homework' ? 'إضافة واجب' : modal.type === 'test' ? 'إضافة اختبار' : modal.type === 'schedule' ? `إضافة حصة • ${modal.day}` : modal.type === 'subjectView' && !addingSubjectLesson ? `دروس مادة ${modal.subject}` : 'إضافة درس للمادة';
  const isLesson = modal.type === 'lesson' || modal.type === 'subjectLesson' || (modal.type === 'subjectView' && addingSubjectLesson);

  if (modal.type === 'subjectView' && !addingSubjectLesson) {
    return <Modal visible animationType="slide" transparent onRequestClose={closeModal}><View style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={closeModal}><Text style={styles.close}>✕</Text></Pressable></View><ScrollView>{modal.items?.length ? modal.items.map((item) => <View style={styles.card} key={item.id}><Text style={styles.cardTitle}>{item.title}</Text>{item.summary ? <Text style={styles.bodyText}>{item.summary}</Text> : null}{item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.lessonImage} /> : null}</View>) : <View style={styles.empty}><Text style={styles.emptyIcon}>📚</Text><Text style={styles.emptyText}>لا توجد دروس لهذه المادة بعد.</Text></View>}<Pressable style={styles.saveButton} onPress={() => setAddingSubjectLesson(true)}><Text style={styles.saveButtonText}>＋ إضافة درس لهذه المادة</Text></Pressable></ScrollView></View></View></Modal>;
  }

  return <Modal visible animationType="slide" transparent onRequestClose={closeModal}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}><View style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={closeModal}><Text style={styles.close}>✕</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><SubjectPicker value={form.subject} onChange={(value) => set('subject', value)} />
    {modal.type === 'schedule' ? <><Field label="رقم/وقت الحصة" value={form.period} onChangeText={(v) => set('period', v)} placeholder="مثال: الحصة الأولى 8:00" /><Field label="المعلم (اختياري)" value={form.teacher} onChangeText={(v) => set('teacher', v)} placeholder="اسم المعلم" /></> : null}
    {modal.type === 'homework' ? <Field label="تفاصيل الواجب" value={form.details} onChangeText={(v) => set('details', v)} placeholder="اكتب المطلوب حله بالتفصيل" multiline /> : null}
    {(modal.type === 'lesson' || modal.type === 'pending' || modal.type === 'test' || modal.type === 'subjectLesson' || (modal.type === 'subjectView' && addingSubjectLesson)) ? <Field label={modal.type === 'test' ? 'اسم الاختبار' : 'اسم الدرس / العنوان'} value={form.title} onChangeText={(v) => set('title', v)} placeholder="مثال: قوانين الحركة" /> : null}
    {isLesson ? <Field label="الملخص أو الملاحظات" value={form.summary} onChangeText={(v) => set('summary', v)} placeholder="اكتب ملخص الدرس هنا..." multiline /> : null}
    {modal.type === 'test' ? <Field label="ملاحظات الاختبار (اختياري)" value={form.notes} onChangeText={(v) => set('notes', v)} placeholder="الفصول المطلوبة أو ملاحظات أخرى" multiline /> : null}
    {(modal.type === 'pending' || modal.type === 'test') ? <DayPicker value={form.day} onChange={(v) => set('day', v)} /> : null}
    {modal.type === 'lesson' || modal.type === 'pending' || modal.type === 'test' ? <Field label="التاريخ" value={form.date} onChangeText={(v) => set('date', v)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /> : null}
    {modal.type === 'homework' ? <Field label="تاريخ التسليم" value={form.dueDate} onChangeText={(v) => set('dueDate', v)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" /> : null}
    {isLesson ? <View style={styles.imageActions}><Pressable style={styles.imageButton} onPress={() => chooseImage('camera', (uri) => set('imageUri', uri))}><Text style={styles.imageButtonText}>📷 التقاط صورة</Text></Pressable><Pressable style={styles.imageButton} onPress={() => chooseImage('library', (uri) => set('imageUri', uri))}><Text style={styles.imageButtonText}>🖼️ اختيار صورة</Text></Pressable></View> : null}{form.imageUri ? <Image source={{ uri: form.imageUri }} style={styles.previewImage} /> : null}
    <Pressable style={styles.saveButton} onPress={submit}><Text style={styles.saveButtonText}>حفظ البيانات</Text></Pressable></ScrollView></View></KeyboardAvoidingView></Modal>;
}

function DayPicker({ value, onChange }) { return <View style={styles.field}><Text style={styles.fieldLabel}>اليوم</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>{WEEK_DAYS.map((day) => <Pressable key={day} style={[styles.pill, value === day && styles.pillActive]} onPress={() => onChange(day)}><Text style={[styles.pillText, value === day && styles.pillTextActive]}>{day}</Text></Pressable>)}</ScrollView></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f4f7fb', direction: 'rtl' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7fb' },
  loadingText: { color: '#123c69', fontSize: 17, fontWeight: '700' },
  header: { backgroundColor: '#123c69', paddingTop: 16, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'right' },
  headerSubtitle: { color: '#cfe2f7', fontSize: 12, marginTop: 4, textAlign: 'right' },
  bell: { width: 44, height: 44, backgroundColor: '#285783', borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  bellText: { fontSize: 21 },
  content: { flex: 1 },
  page: { padding: 16, paddingBottom: 30 },
  pageHeading: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 18, gap: 10 },
  pageTitle: { color: '#123c69', fontSize: 23, fontWeight: '800', textAlign: 'right' },
  pageSubtitle: { color: '#6d7d8f', fontSize: 13, marginTop: 4, textAlign: 'right' },
  primaryButton: { backgroundColor: '#16866f', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 13 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  statsRow: { flexDirection: 'row-reverse', gap: 9, marginBottom: 18 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 15, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#e1eaf3' },
  statNumber: { color: '#16866f', fontSize: 23, fontWeight: '900' },
  statLabel: { color: '#6d7d8f', fontSize: 11, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#e2eaf2', shadowColor: '#123c69', shadowOpacity: 0.04, shadowRadius: 5, elevation: 1 },
  completedCard: { opacity: 0.72, backgroundColor: '#f4fbf6' },
  cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipText: { color: '#315778', fontSize: 11, fontWeight: '800' },
  deleteText: { color: '#c84b55', fontSize: 12, fontWeight: '700' },
  cardTitle: { color: '#193654', fontSize: 17, fontWeight: '800', textAlign: 'right' },
  meta: { color: '#718195', fontSize: 12, textAlign: 'right', marginTop: 8 },
  bodyText: { color: '#526678', fontSize: 14, lineHeight: 23, textAlign: 'right', marginTop: 10 },
  lessonImage: { width: '100%', height: 190, borderRadius: 12, marginTop: 12, resizeMode: 'cover' },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 35, alignItems: 'center', borderWidth: 1, borderColor: '#e2eaf2' },
  emptyIcon: { fontSize: 34, marginBottom: 10 },
  emptyText: { color: '#77889a', textAlign: 'center', fontSize: 14 },
  hint: { color: '#64778a', backgroundColor: '#eaf3fb', padding: 12, borderRadius: 12, marginBottom: 14, textAlign: 'right', lineHeight: 21 },
  dayBlock: { backgroundColor: '#fff', borderRadius: 15, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: '#e2eaf2' },
  dayHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dayTitle: { color: '#123c69', fontSize: 18, fontWeight: '800' },
  smallButton: { backgroundColor: '#e6f4ef', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9 },
  smallButtonText: { color: '#16866f', fontWeight: '800', fontSize: 12 },
  scheduleItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#edf1f5', paddingVertical: 10 },
  scheduleText: { color: '#34536e', fontSize: 14, flex: 1, textAlign: 'right' },
  muted: { color: '#9aa8b5', fontSize: 13, textAlign: 'right', paddingVertical: 5 },
  checkRow: { flexDirection: 'row-reverse', alignItems: 'center', marginTop: 13, gap: 8 },
  checkbox: { fontSize: 24, color: '#16866f' },
  checkText: { color: '#4d667c', fontSize: 13 },
  strike: { textDecorationLine: 'line-through' },
  subjectGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  subjectBox: { width: '31.5%', minHeight: 116, backgroundColor: '#fff', borderRadius: 15, padding: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2eaf2' },
  subjectIcon: { fontSize: 24, marginBottom: 5 },
  subjectName: { color: '#234863', fontSize: 12, textAlign: 'center', fontWeight: '800', lineHeight: 17 },
  subjectCount: { color: '#16866f', fontSize: 11, marginTop: 5 },
  tabBar: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e1e8ef', paddingVertical: 7 },
  tabScroll: { paddingHorizontal: 7, gap: 5 },
  tab: { minWidth: 68, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 5, borderRadius: 11 },
  tabActive: { backgroundColor: '#e6f4ef' },
  tabIcon: { fontSize: 18 },
  tabLabel: { color: '#718195', fontSize: 10, marginTop: 3, fontWeight: '700' },
  tabLabelActive: { color: '#16866f' },
  toast: { position: 'absolute', bottom: 78, alignSelf: 'center', backgroundColor: '#193654', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22 },
  toastText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(11,35,58,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#f8fbfe', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { color: '#123c69', fontSize: 21, fontWeight: '900' },
  close: { color: '#c84b55', fontSize: 22, padding: 5 },
  field: { marginBottom: 13 },
  fieldLabel: { color: '#34536e', fontSize: 13, fontWeight: '800', textAlign: 'right', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d7e3ed', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, color: '#193654', fontSize: 14, minHeight: 46 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  pickerRow: { flexDirection: 'row-reverse', gap: 7, paddingVertical: 2 },
  pill: { borderWidth: 1, borderColor: '#d6e2ec', backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 8 },
  pillActive: { backgroundColor: '#16866f', borderColor: '#16866f' },
  pillText: { color: '#526b81', fontSize: 11, fontWeight: '700' },
  pillTextActive: { color: '#fff' },
  imageActions: { flexDirection: 'row-reverse', gap: 8, marginBottom: 10 },
  imageButton: { flex: 1, backgroundColor: '#e8f1fb', borderRadius: 10, padding: 11, alignItems: 'center' },
  imageButtonText: { color: '#315778', fontSize: 12, fontWeight: '800' },
  previewImage: { width: '100%', height: 140, borderRadius: 11, marginBottom: 12 },
  saveButton: { backgroundColor: '#123c69', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6, marginBottom: 15 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
