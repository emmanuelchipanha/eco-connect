import { useEffect, useMemo, useState, type FormEvent } from 'react';
import './App.css';
import { supabase } from './supabase';

type Page =
  | 'dashboard'
  | 'groups'
  | 'members'
  | 'transactions'
  | 'loans'
  | 'applications'
  | 'sms'
  | 'bank'
  | 'reports'
  | 'settings';
type Row = Record<string, any>;
const NAV: { id: Page; icon: string; sw: string; en: string }[] = [
  { id: 'dashboard', icon: '▦', sw: 'Muhtasari', en: 'Dashboard' },
  { id: 'groups', icon: '⌂', sw: 'Vikundi', en: 'Groups' },
  { id: 'members', icon: '♙', sw: 'Wanachama', en: 'Members' },
  { id: 'transactions', icon: '⇄', sw: 'Miamala', en: 'Transactions' },
  {
    id: 'applications',
    icon: '▣',
    sw: 'Maombi ya mikopo',
    en: 'Loan applications',
  },
  { id: 'loans', icon: '▤', sw: 'Loan Register', en: 'Loan Register' },
  { id: 'sms', icon: '✉', sw: 'Ujumbe wa SMS', en: 'SMS messages' },
  { id: 'bank', icon: '▧', sw: 'Taarifa za kibenki', en: 'Banking' },
  {
    id: 'reports',
    icon: '▥',
    sw: 'Ripoti na upakuaji',
    en: 'Reports & downloads',
  },
  {
    id: 'settings',
    icon: '⚙',
    sw: 'Usimamizi wa Mfumo',
    en: 'System management',
  },
];
const TABLES: Partial<Record<Page, string>> = {
  groups: 'eco_groups',
  members: 'eco_members',
  transactions: 'eco_monthly_transactions',
  loans: 'eco_loan_register',
  applications: 'eco_loan_application',
  sms: 'eco_sms_outbox',
  bank: 'eco_bank_transaction',
};
const money = (n: any) => new Intl.NumberFormat('en-TZ').format(Number(n || 0));
const label = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();
function downloadCsv(filename: string, rows: Row[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    cols.map(esc).join(','),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(',')),
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  );
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
function App() {
  const [language, setLanguage] = useState<'sw' | 'en'>('sw'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [showPassword, setShowPassword] = useState(false);
  const [logged, setLogged] = useState(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(''),
    [active, setActive] = useState<Page>('dashboard');
  const [groups, setGroups] = useState<Row[]>([]),
    [members, setMembers] = useState<Row[]>([]),
    [transactions, setTransactions] = useState<Row[]>([]),
    [loans, setLoans] = useState<Row[]>([]),
    [smsRows, setSmsRows] = useState<Row[]>([]),
    [applications, setApplications] = useState<Row[]>([]);
  const [masterView, setMasterView] = useState<Row[]>([]),
    [selectedGroup, setSelectedGroup] = useState('ALL'),
    [search, setSearch] = useState(''),
    [subView, setSubView] = useState('list');
  const [memberForm, setMemberForm] = useState({
    full_name: '',
    gender: 'F',
    education_level: '',
    primary_livelihood: '',
    village: '',
    group_id: '',
    nida_number: '',
  });
  const [photo, setPhoto] = useState<File | null>(null),
    [nidaFile, setNidaFile] = useState<File | null>(null);
  const [depositForm, setDepositForm] = useState({
    member_id: '',
    amount_tzs: '',
    deposit_type: 'CASH DEPOSIT',
    transaction_date: today(),
    phone_number: '',
    consent: false,
  });
  const [loanForm, setLoanForm] = useState({
    member_id: '',
    loan_received_tzs: '',
    loan_date: today(),
    loan_circle: '',
    phone_number: '',
    consent: false,
  });
  const [smsForm, setSmsForm] = useState({
    member_id: '',
    phone_number: '',
    sms_type: 'GENERAL',
    message_body: '',
    consent: false,
  });
  const [appForm, setAppForm] = useState({
    member_id: '',
    requested_amount_tzs: '',
    phone_number: '',
    consent: false,
  });
  const [appFile, setAppFile] = useState<File | null>(null),
    [businessFile, setBusinessFile] = useState<File | null>(null);
  const t = (sw: string, en: string) => (language === 'sw' ? sw : en);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLogged(!!data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setLogged(!!s));
    return () => subscription.unsubscribe();
  }, []);
  async function loadAll() {
    setLoading(true);
    setMessage('');
    const [g, m, tx, l, s, a, v] = await Promise.all([
      supabase.from('eco_groups').select('*').order('group_name'),
      supabase.from('eco_members').select('*').order('member_code'),
      supabase
        .from('eco_monthly_transactions')
        .select('*')
        .order('transaction_date', { ascending: false })
        .limit(1000),
      supabase
        .from('eco_loan_register')
        .select('*')
        .order('loan_date', { ascending: false })
        .limit(1000),
      supabase
        .from('eco_sms_outbox')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('eco_loan_applications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('eco_master_data_current').select('*').limit(2000),
    ]);
    const errs = [g.error, m.error, tx.error, l.error, s.error, v.error].filter(
      Boolean
    );
    if (errs.length) setMessage(errs.map((e) => e!.message).join(' | '));
    setGroups(g.data || []);
    setMembers(m.data || []);
    setTransactions(tx.data || []);
    setLoans(l.data || []);
    setSmsRows(s.data || []);
    if (!a.error) setApplications(a.data || []);
    else {
      const fallback = await supabase
        .from('eco_loan_application')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      setApplications(fallback.data || []);
    }
    setMasterView(v.data || []);
    setLoading(false);
  }
  useEffect(() => {
    if (logged) loadAll();
  }, [logged]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setMessage(error.message);
    setLoading(false);
  }
  async function logout() {
    await supabase.auth.signOut();
    setLogged(false);
    setActive('dashboard');
  }
  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.group_name || '';
  const member = (id: string) => members.find((m) => m.id === id);
  const memberSavings = (id: string) =>
    masterView.find((r) => r.id === id)?.total_savings_current ??
    masterView.find((r) => r.member_id === id)?.total_savings_current ??
    0;
  const visibleMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          (selectedGroup === 'ALL' || m.group_id === selectedGroup) &&
          m.registration_status !== 'INACTIVE' &&
          m.registration_status !== 'EXITED' &&
          `${m.member_code} ${m.full_name} ${m.village} ${m.primary_livelihood}`
            .toLowerCase()
            .includes(search.toLowerCase())
      ),
    [members, selectedGroup, search]
  );
  async function uploadPrivate(bucket: string, file: File, memberCode: string) {
    const ext = file.name.split('.').pop() || 'bin';
    const path = `${memberCode}/${Date.now()}-${uid()}.${ext}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });
    if (error) throw error;
    return path;
  }
  async function registerMember(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      if (!memberForm.group_id) throw new Error('Chagua kikundi.');
      if (!memberForm.nida_number.trim())
        throw new Error('Weka namba ya NIDA.');
      if (!photo) throw new Error('Pakia picha ya mwanachama.');
      const { data: auth } = await supabase.auth.getUser();
      let photoPath: string | null = null,
        nidaPath: string | null = null;
      try {
        photoPath = await uploadPrivate(
          'member-documents',
          photo,
          `photo-${auth.user?.id || 'member'}`
        );
        const recordKey = uid();
        const scanPath = nidaFile
          ? await uploadPrivate(
              'member-documents',
              nidaFile,
              `nida-scan-${recordKey}`
            )
          : null;
        const manifest = new Blob(
          [
            JSON.stringify({
              nida_number: memberForm.nida_number.trim(),
              document_path: scanPath,
              uploaded_at: new Date().toISOString(),
            }),
          ],
          { type: 'application/json' }
        );
        const manifestPath = `nida/${recordKey}.json`;
        const { error: manifestError } = await supabase.storage
          .from('member-documents')
          .upload(manifestPath, manifest, { contentType: 'application/json' });
        if (manifestError) throw manifestError;
        nidaPath = manifestPath;
      } catch (err: any) {
        throw new Error(
          `Upload imeshindikana. Hakikisha private bucket member-documents ipo na policies zinaruhusu upload. ${
            err.message || ''
          }`
        );
      }
      const payload = {
        full_name: memberForm.full_name.trim(),
        gender: memberForm.gender,
        education_level: memberForm.education_level || null,
        primary_livelihood: memberForm.primary_livelihood || null,
        village: memberForm.village || null,
        group_id: memberForm.group_id,
        opening_initial_savings_tzs: 0,
        opening_total_savings_tzs: 0,
        opening_total_loan_received_tzs: 0,
        opening_total_loan_paid_tzs: 0,
        opening_historical_loan_paid_tzs: 0,
        photo_storage_path: photoPath,
        nida_storage_path: nidaPath,
        registration_status: 'ACTIVE',
        registered_at: today(),
        created_by: auth.user?.id || null,
      };
      const { data: newMember, error } = await supabase
        .from('eco_members')
        .insert(payload)
        .select('member_code')
        .single();
      if (error) throw error;
      setMessage(`Mwanachama amesajiliwa. Member ID: ${newMember.member_code}`);
      setMemberForm({
        full_name: '',
        gender: 'F',
        education_level: '',
        primary_livelihood: '',
        village: '',
        group_id: '',
        nida_number: '',
      });
      setPhoto(null);
      setNidaFile(null);
      setSubView('list');
      await loadAll();
    } catch (err: any) {
      setMessage(err.message || 'Usajili haujafanikiwa.');
    }
    setLoading(false);
  }
  async function deactivateMember(m: Row) {
    if (
      !confirm(
        `Unataka kumuweka ${m.full_name} (${m.member_code}) INACTIVE? Historia ya fedha itabaki.`
      )
    )
      return;
    setLoading(true);
    const { error } = await supabase
      .from('eco_members')
      .update({ registration_status: 'INACTIVE' })
      .eq('id', m.id);
    setMessage(
      error
        ? error.message
        : 'Mwanachama amewekwa INACTIVE; historia yake imehifadhiwa.'
    );
    await loadAll();
    setLoading(false);
  }
  async function queueSms(
    memberId: string,
    phone: string,
    type: string,
    ref: string,
    body: string,
    consent: boolean,
    groupId: string
  ) {
    if (!phone.trim()) return;
    if (!consent)
      throw new Error('Lazima uthibitishe ridhaa ya mwanachama kupokea SMS.');
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('eco_sms_outbox')
      .insert({
        sms_id: uid(),
        member_id: memberId,
        group_id: groupId,
        phone_number: phone.trim(),
        sms_type: type,
        reference_id: ref,
        message_body: body,
        scheduled_at: new Date().toISOString(),
        sms_status: 'QUEUED',
        consent_confirmed: true,
        created_by: auth.user?.id || null,
      });
    if (error) throw error;
  }
  async function saveDeposit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const m = member(depositForm.member_id);
      if (!m) throw new Error('Chagua mwanachama sahihi.');
      if (depositForm.phone_number && !depositForm.consent)
        throw new Error('Thibitisha ridhaa ya SMS kabla ya kuhifadhi muamala.');
      const amount = Number(depositForm.amount_tzs);
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error('Weka kiasi sahihi.');
      const transactionId = uid();
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('eco_monthly_transactions')
        .insert({
          member_id: m.id,
          group_id: m.group_id,
          amount_tzs: amount,
          transaction_id: transactionId,
          deposit_type: depositForm.deposit_type,
          transaction_date: depositForm.transaction_date,
          source: 'APP',
          entered_by: auth.user?.id || null,
        });
      if (error) throw error;
      if (depositForm.phone_number) {
        await queueSms(
          m.id,
          depositForm.phone_number,
          'DEPOSIT_CONFIRMATION',
          transactionId,
          `Hisa Eco: Tumepokea TZS ${money(amount)} kutoka ${m.full_name} (${
            m.member_code
          }) tarehe ${
            depositForm.transaction_date
          }. Transaction ID: ${transactionId}. Asante.`,
          depositForm.consent,
          m.group_id
        );
      }
      setMessage(
        `Amana imehifadhiwa. Transaction ID: ${transactionId}${
          depositForm.phone_number
            ? ' • SMS imewekwa kwenye foleni (QUEUED).'
            : ''
        }`
      );
      setDepositForm({
        member_id: '',
        amount_tzs: '',
        deposit_type: 'CASH DEPOSIT',
        transaction_date: today(),
        phone_number: '',
        consent: false,
      });
      await loadAll();
    } catch (err: any) {
      setMessage(err.message || 'Imeshindikana kuhifadhi amana.');
    }
    setLoading(false);
  }
  async function saveLoan(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const m = member(loanForm.member_id);
      if (!m) throw new Error('Chagua mwanachama.');
      if (loanForm.phone_number && !loanForm.consent)
        throw new Error('Thibitisha ridhaa ya SMS kabla ya kuhifadhi mkopo.');
      const amount = Number(loanForm.loan_received_tzs);
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error('Weka kiasi cha mkopo.');
      const transactionId = uid();
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('eco_loan_register')
        .insert({
          member_id: m.id,
          group_id: m.group_id,
          loan_received_tzs: amount,
          transaction_id: transactionId,
          loan_date: loanForm.loan_date,
          loan_circle: loanForm.loan_circle || null,
          source: 'APP',
          entered_by: auth.user?.id || null,
        });
      if (error) throw error;
      if (loanForm.phone_number)
        await queueSms(
          m.id,
          loanForm.phone_number,
          'LOAN_DISBURSEMENT',
          transactionId,
          `Hisa Eco: Mkopo wa TZS ${money(amount)} umeandikwa kwa ${
            m.full_name
          } (${m.member_code}) tarehe ${
            loanForm.loan_date
          }. Transaction ID: ${transactionId}.`,
          loanForm.consent,
          m.group_id
        );
      setMessage(
        `Mkopo umehifadhiwa. Transaction ID: ${transactionId}${
          loanForm.phone_number ? ' • SMS imewekwa kwenye foleni.' : ''
        }`
      );
      setLoanForm({
        member_id: '',
        loan_received_tzs: '',
        loan_date: today(),
        loan_circle: '',
        phone_number: '',
        consent: false,
      });
      await loadAll();
    } catch (err: any) {
      setMessage(err.message || 'Imeshindikana kuhifadhi mkopo.');
    }
    setLoading(false);
  }
  async function sendManualSms(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const m = member(smsForm.member_id);
      if (!m) throw new Error('Chagua mwanachama.');
      await queueSms(
        m.id,
        smsForm.phone_number,
        smsForm.sms_type,
        uid(),
        smsForm.message_body,
        smsForm.consent,
        m.group_id
      );
      setMessage(
        'SMS imewekwa kwenye foleni (QUEUED). Haijathibitishwa kutumwa mpaka SMS gateway iunganishwe.'
      );
      setSmsForm({
        member_id: '',
        phone_number: '',
        sms_type: 'GENERAL',
        message_body: '',
        consent: false,
      });
      await loadAll();
    } catch (err: any) {
      setMessage(err.message || 'Imeshindikana kuandaa SMS.');
    }
    setLoading(false);
  }
  async function submitApplication(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const m = member(appForm.member_id);
      if (!m) throw new Error('Chagua mwanachama.');
      if (!appFile || !businessFile)
        throw new Error('Pakia fomu ya maombi na mpango wa biashara.');
      const ref = `ECO-LOAN-${Date.now()}`;
      const upload = async (file: File, folder: string) => {
        const path = `${ref}/${folder}-${file.name}`;
        const { error } = await supabase.storage
          .from('loan-documents')
          .upload(path, file);
        if (error) throw error;
        return path;
      };
      const [applicationPath, businessPath] = await Promise.all([
        upload(appFile, 'application'),
        upload(businessFile, 'business-plan'),
      ]);
      const { data: auth } = await supabase.auth.getUser();
      const applicationPayload = {
        application_ref: ref,
        member_id: m.id,
        group_id: m.group_id,
        requested_amount_tzs: Number(appForm.requested_amount_tzs),
        status: 'SUBMITTED',
        application_file_path: applicationPath,
        business_plan_file_path: businessPath,
        submitted_at: new Date().toISOString(),
        created_by: auth.user?.id || null,
      };
      let { error } = await supabase
        .from('eco_loan_applications')
        .insert(applicationPayload);
      if (error) {
        const fallback = await supabase
          .from('eco_loan_application')
          .insert(applicationPayload);
        error = fallback.error;
      }
      if (error) throw error;
      setMessage(
        `Ombi ${ref} limehifadhiwa. Mashahidi/uthibitisho wa ngazi za approval utaendelea kwenye workflow.`
      );
      setAppForm({
        member_id: '',
        requested_amount_tzs: '',
        phone_number: '',
        consent: false,
      });
      setAppFile(null);
      setBusinessFile(null);
      await loadAll();
    } catch (err: any) {
      setMessage(
        err.message ||
          'Ombi halijahifadhiwa. Hakikisha bucket loan-documents na policies zipo.'
      );
    }
    setLoading(false);
  }
  const title =
    NAV.find((n) => n.id === active)?.[language === 'sw' ? 'sw' : 'en'] ||
    'Dashboard';
  const groupOptions = (
    <>
      <option value="">{t('Chagua kikundi', 'Select group')}</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.group_name}
        </option>
      ))}
    </>
  );
  const memberOptions = (
    <>
      <option value="">
        {t('Chagua Member ID / jina', 'Select member ID / name')}
      </option>
      {members
        .filter(
          (m) => m.registration_status === 'ACTIVE' || !m.registration_status
        )
        .map((m) => (
          <option key={m.id} value={m.id}>
            {m.member_code} — {m.full_name}
          </option>
        ))}
    </>
  );
  const field = (
    name: string,
    sw: string,
    en: string,
    value: string,
    onChange: (v: string) => void,
    type = 'text',
    required = false
  ) => (
    <label className="ec-field">
      {t(sw, en)}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </label>
  );
  function membersPage() {
    return (
      <>
        <div className="ec-toolbar">
          <div>
            <h2>{t('Usimamizi wa wanachama', 'Member management')}</h2>
            <p>
              {t(
                'Chagua vikundi vyote au kikundi kimoja kuona orodha na taarifa za wanachama.',
                'Choose all groups or one group to view member records.'
              )}
            </p>
          </div>
          <button
            className="primary-btn"
            onClick={() =>
              setSubView(subView === 'register' ? 'list' : 'register')
            }
          >
            {subView === 'register'
              ? t('Rudi kwenye orodha', 'Back to list')
              : t('+ Sajili mwanachama mpya', '+ Register new member')}
          </button>
        </div>
        {subView === 'register' ? (
          <form className="ec-form" onSubmit={registerMember}>
            <h3>
              {t('Fomu ya usajili wa mwanachama', 'New member registration')}
            </h3>
            <div className="ec-form-grid">
              {field(
                'full_name',
                'Jina kamili',
                'Full name',
                memberForm.full_name,
                (v) => setMemberForm({ ...memberForm, full_name: v }),
                'text',
                true
              )}
              <label className="ec-field">
                {t('Jinsia', 'Gender')}
                <select
                  value={memberForm.gender}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, gender: e.target.value })
                  }
                >
                  <option value="F">F</option>
                  <option value="M">M</option>
                </select>
              </label>
              {field(
                'nida_number',
                'Namba ya NIDA',
                'NIDA number',
                memberForm.nida_number,
                (v) => setMemberForm({ ...memberForm, nida_number: v }),
                'text',
                true
              )}
              {field(
                'education_level',
                'Kiwango cha elimu',
                'Education level',
                memberForm.education_level,
                (v) => setMemberForm({ ...memberForm, education_level: v })
              )}
              {field(
                'primary_livelihood',
                'Shughuli kuu ya kiuchumi',
                'Primary livelihood',
                memberForm.primary_livelihood,
                (v) => setMemberForm({ ...memberForm, primary_livelihood: v })
              )}
              {field('village', 'Kijiji', 'Village', memberForm.village, (v) =>
                setMemberForm({ ...memberForm, village: v })
              )}
              <label className="ec-field">
                {t('Kikundi', 'Group')}
                <select
                  value={memberForm.group_id}
                  onChange={(e) =>
                    setMemberForm({ ...memberForm, group_id: e.target.value })
                  }
                  required
                >
                  {groupOptions}
                </select>
              </label>
              <label className="ec-field">
                {t('Picha ya mwanachama', 'Member photo')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  required
                />
              </label>
              <label className="ec-field">
                {t(
                  'NIDA (picha/PDF) — hiari',
                  'NIDA file (image/PDF) — optional'
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setNidaFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <p className="ec-hint">
              {t(
                'Member ID itazalishwa na database kwa mfuatano wa HE-0001. Namba ya NIDA itahifadhiwa kwenye faili la JSON ndani ya private storage, si kwenye jedwali la kawaida la wanachama.',
                'Member ID is generated by the database. NIDA number is not stored as plain text; the uploaded file is stored privately.'
              )}
            </p>
            <button className="primary-btn" disabled={loading}>
              {loading
                ? t('Inasajili...', 'Registering...')
                : t('Hifadhi mwanachama', 'Save member')}
            </button>
          </form>
        ) : (
          <>
            <div className="ec-filter-row">
              <label>
                {t('Chagua kikundi', 'Select group')}
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                >
                  <option value="ALL">
                    {t('Vikundi vyote', 'All groups')}
                  </option>
                  {groupOptions}
                </select>
              </label>
              <input
                placeholder={t(
                  'Tafuta ID, jina, kijiji...',
                  'Search ID, name, village...'
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                className="secondary-btn"
                onClick={() =>
                  downloadCsv(
                    'ECO_CONNECT_MEMBERS.csv',
                    visibleMembers.map((m) => ({
                      member_code: m.member_code,
                      full_name: m.full_name,
                      gender: m.gender,
                      group: groupName(m.group_id),
                      village: m.village,
                      education_level: m.education_level,
                      primary_livelihood: m.primary_livelihood,
                      registration_status: m.registration_status,
                    }))
                  )
                }
              >
                {t('Pakua CSV', 'Download CSV')}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      'Member ID',
                      'Jina',
                      'Kikundi',
                      'Kijiji',
                      'Jinsia',
                      'Elimu',
                      'Primary livelihood',
                      'Akiba (TZS)',
                      'Hali',
                      'Kitendo',
                    ].map((x) => (
                      <th key={x}>{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleMembers.map((m) => (
                    <tr key={m.id}>
                      <td>{m.member_code}</td>
                      <td>{m.full_name}</td>
                      <td>{groupName(m.group_id)}</td>
                      <td>{m.village || '—'}</td>
                      <td>{m.gender || '—'}</td>
                      <td>{m.education_level || '—'}</td>
                      <td>{m.primary_livelihood || '—'}</td>
                      <td>{money(memberSavings(m.id))}</td>
                      <td>{m.registration_status || 'ACTIVE'}</td>
                      <td>
                        <button
                          className="danger-btn"
                          onClick={() => deactivateMember(m)}
                        >
                          {t('Weka inactive', 'Deactivate')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ec-hint">
              {visibleMembers.length}{' '}
              {t(
                'wanachama wanaoonekana. Kuondoa mwanachama humuweka INACTIVE; historia ya miamala haifutwi.',
                'members shown. Deactivation preserves transaction history.'
              )}
            </p>
          </>
        )}
      </>
    );
  }
  function transactionsPage() {
    return (
      <>
        <div className="ec-toolbar">
          <div>
            <h2>{t('Amana za kila wiki', 'Weekly deposits')}</h2>
            <p>
              {t(
                'Mpangilio unafuata MONTHLY DATA(TRANSACTIONS-NEW): Member ID, Name, Village, Group, Deposit, Transaction ID, Deposit Type, Date.',
                'Workbook-aligned deposit register.'
              )}
            </p>
          </div>
          <button
            className="secondary-btn"
            onClick={() =>
              downloadCsv('ECO_CONNECT_MONTHLY_DATA.csv', transactions)
            }
          >
            {t('Pakua miamala yote', 'Download all transactions')}
          </button>
        </div>
        <form className="ec-form" onSubmit={saveDeposit}>
          <h3>{t('Sajili amana mpya', 'Record new deposit')}</h3>
          <div className="ec-form-grid">
            <label className="ec-field">
              Member ID / jina
              <select
                value={depositForm.member_id}
                onChange={(e) =>
                  setDepositForm({ ...depositForm, member_id: e.target.value })
                }
                required
              >
                {memberOptions}
              </select>
            </label>
            {field(
              'amount',
              'Kiasi cha amana (TZS)',
              'Deposit amount (TZS)',
              depositForm.amount_tzs,
              (v) => setDepositForm({ ...depositForm, amount_tzs: v }),
              'number',
              true
            )}
            <label className="ec-field">
              {t('Aina ya muamala', 'Deposit type')}
              <select
                value={depositForm.deposit_type}
                onChange={(e) =>
                  setDepositForm({
                    ...depositForm,
                    deposit_type: e.target.value,
                  })
                }
              >
                <option value="CASH DEPOSIT">CASH DEPOSIT</option>
                <option value="LOAN REPAYMENT">LOAN REPAYMENT</option>
              </select>
            </label>
            {field(
              'date',
              'Tarehe',
              'Date',
              depositForm.transaction_date,
              (v) => setDepositForm({ ...depositForm, transaction_date: v }),
              'date',
              true
            )}
            {field(
              'phone',
              'Namba ya simu kwa SMS',
              'Phone for SMS',
              depositForm.phone_number,
              (v) => setDepositForm({ ...depositForm, phone_number: v }),
              'tel'
            )}
          </div>
          {depositForm.phone_number && (
            <label className="ec-check">
              <input
                type="checkbox"
                checked={depositForm.consent}
                onChange={(e) =>
                  setDepositForm({ ...depositForm, consent: e.target.checked })
                }
              />
              {t(
                'Mwanachama amekubali kupokea SMS',
                'Member consented to receive SMS'
              )}
            </label>
          )}
          <button className="primary-btn" disabled={loading}>
            {t('Hifadhi amana', 'Save deposit')}
          </button>
        </form>
        <div className="ec-toolbar">
          <h3>{t('Miamala ya hivi karibuni', 'Recent transactions')}</h3>
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="ALL">{t('Vikundi vyote', 'All groups')}</option>
            {groupOptions}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Name</th>
                <th>Village</th>
                <th>Group</th>
                <th>Deposit (TZS)</th>
                <th>Transaction ID</th>
                <th>Deposit Type</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions
                .filter(
                  (r) => selectedGroup === 'ALL' || r.group_id === selectedGroup
                )
                .map((r) => {
                  const m = member(r.member_id);
                  return (
                    <tr key={r.id}>
                      <td>{m?.member_code || '—'}</td>
                      <td>{m?.full_name || '—'}</td>
                      <td>{m?.village || '—'}</td>
                      <td>{groupName(r.group_id)}</td>
                      <td>{money(r.amount_tzs)}</td>
                      <td>{r.transaction_id}</td>
                      <td>{r.deposit_type}</td>
                      <td>{r.transaction_date}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  function loansPage() {
    return (
      <>
        <div className="ec-toolbar">
          <div>
            <h2>Loan Register</h2>
            <p>
              {t(
                'Mpangilio unafuata LOAN REGISTER-NEW: Member ID, Name, Village, Group, Loan Received, Transaction ID, Date, Loan Circle.',
                'Workbook-aligned loan register.'
              )}
            </p>
          </div>
          <button
            className="secondary-btn"
            onClick={() => downloadCsv('ECO_CONNECT_LOAN_REGISTER.csv', loans)}
          >
            {t('Pakua mikopo', 'Download loans')}
          </button>
        </div>
        <form className="ec-form" onSubmit={saveLoan}>
          <h3>{t('Sajili mkopo uliotolewa', 'Record loan disbursement')}</h3>
          <div className="ec-form-grid">
            <label className="ec-field">
              Member ID / jina
              <select
                value={loanForm.member_id}
                onChange={(e) =>
                  setLoanForm({ ...loanForm, member_id: e.target.value })
                }
                required
              >
                {memberOptions}
              </select>
            </label>
            {field(
              'loan',
              'Kiasi cha mkopo (TZS)',
              'Loan amount (TZS)',
              loanForm.loan_received_tzs,
              (v) => setLoanForm({ ...loanForm, loan_received_tzs: v }),
              'number',
              true
            )}
            {field(
              'date',
              'Tarehe',
              'Date',
              loanForm.loan_date,
              (v) => setLoanForm({ ...loanForm, loan_date: v }),
              'date',
              true
            )}
            {field(
              'circle',
              'Loan Circle',
              'Loan Circle',
              loanForm.loan_circle,
              (v) => setLoanForm({ ...loanForm, loan_circle: v })
            )}
            {field(
              'phone',
              'Namba ya simu kwa SMS',
              'Phone for SMS',
              loanForm.phone_number,
              (v) => setLoanForm({ ...loanForm, phone_number: v }),
              'tel'
            )}
          </div>
          {loanForm.phone_number && (
            <label className="ec-check">
              <input
                type="checkbox"
                checked={loanForm.consent}
                onChange={(e) =>
                  setLoanForm({ ...loanForm, consent: e.target.checked })
                }
              />
              {t(
                'Mwanachama amekubali kupokea SMS',
                'Member consented to receive SMS'
              )}
            </label>
          )}
          <button className="primary-btn" disabled={loading}>
            {t('Hifadhi mkopo', 'Save loan')}
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Name</th>
                <th>Village</th>
                <th>Group</th>
                <th>Loan Received</th>
                <th>Transaction ID</th>
                <th>Date</th>
                <th>Loan Circle</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((r) => {
                const m = member(r.member_id);
                return (
                  <tr key={r.id}>
                    <td>{m?.member_code || '—'}</td>
                    <td>{m?.full_name || '—'}</td>
                    <td>{m?.village || '—'}</td>
                    <td>{groupName(r.group_id)}</td>
                    <td>{money(r.loan_received_tzs)}</td>
                    <td>{r.transaction_id}</td>
                    <td>{r.loan_date}</td>
                    <td>{r.loan_circle || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  function smsPage() {
    return (
      <>
        <div className="ec-toolbar">
          <div>
            <h2>{t('ECO CONNECT SMS', 'ECO CONNECT SMS')}</h2>
            <p>
              {t(
                'Namba za simu zinahifadhiwa kwenye SMS outbox pekee; haziongezwi kwenye Master Data, Monthly Data au Loan Register.',
                'Phone numbers are stored in SMS outbox only.'
              )}
            </p>
          </div>
          <button
            className="secondary-btn"
            onClick={() => downloadCsv('ECO_CONNECT_SMS_OUTBOX.csv', smsRows)}
          >
            {t('Pakua SMS log', 'Download SMS log')}
          </button>
        </div>
        <form className="ec-form" onSubmit={sendManualSms}>
          <h3>{t('Andaa SMS mpya', 'Compose SMS')}</h3>
          <div className="ec-form-grid">
            <label className="ec-field">
              Mwanachama
              <select
                value={smsForm.member_id}
                onChange={(e) =>
                  setSmsForm({ ...smsForm, member_id: e.target.value })
                }
                required
              >
                {memberOptions}
              </select>
            </label>
            {field(
              'phone',
              'Namba ya simu',
              'Phone number',
              smsForm.phone_number,
              (v) => setSmsForm({ ...smsForm, phone_number: v }),
              'tel',
              true
            )}
            <label className="ec-field">
              {t('Aina ya SMS', 'SMS type')}
              <select
                value={smsForm.sms_type}
                onChange={(e) =>
                  setSmsForm({ ...smsForm, sms_type: e.target.value })
                }
              >
                <option value="GENERAL">GENERAL</option>
                <option value="DEPOSIT_REMINDER">DEPOSIT REMINDER</option>
                <option value="LOAN_REMINDER">LOAN REMINDER</option>
                <option value="MEETING_REMINDER">MEETING REMINDER</option>
                <option value="ANNOUNCEMENT">ANNOUNCEMENT</option>
              </select>
            </label>
          </div>
          <label className="ec-field">
            {t('Ujumbe', 'Message')}
            <textarea
              rows={4}
              value={smsForm.message_body}
              onChange={(e) =>
                setSmsForm({ ...smsForm, message_body: e.target.value })
              }
              required
            />
          </label>
          <label className="ec-check">
            <input
              type="checkbox"
              checked={smsForm.consent}
              onChange={(e) =>
                setSmsForm({ ...smsForm, consent: e.target.checked })
              }
            />
            {t(
              'Nathibitisha mwanachama amekubali kupokea SMS',
              'I confirm the member consented to SMS'
            )}
          </label>
          <button className="primary-btn" disabled={loading}>
            {t('Weka SMS kwenye foleni', 'Queue SMS')}
          </button>
        </form>
        <div className="notice">
          {t(
            'SMS huingia QUEUED. Kutumwa moja kwa moja kunahitaji SMS gateway/Edge Function na credentials za mtoa huduma; interface hii haitadai kuwa SMS imetumwa kabla gateway haijathibitisha.',
            'Messages are queued. Actual sending requires an SMS gateway/Edge Function and provider credentials.'
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SMS ID</th>
                <th>Member</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Reference ID</th>
                <th>Message</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {smsRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.sms_id}</td>
                  <td>{member(r.member_id)?.full_name || '—'}</td>
                  <td>{r.phone_number}</td>
                  <td>{r.sms_type}</td>
                  <td>{r.reference_id || '—'}</td>
                  <td>{r.message_body}</td>
                  <td>{r.sms_status}</td>
                  <td>{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  function applicationsPage() {
    return (
      <>
        <div className="ec-toolbar">
          <div>
            <h2>{t('Maombi ya mikopo', 'Loan applications')}</h2>
            <p>
              {t(
                'Kila ombi linahitaji fomu ya maombi na mpango wa biashara. Sababu ya mkopo haitakuwa sehemu tofauti.',
                'Each application requires the signed application form and business plan.'
              )}
            </p>
          </div>
        </div>
        <form className="ec-form" onSubmit={submitApplication}>
          <div className="ec-form-grid">
            <label className="ec-field">
              Mwanachama
              <select
                value={appForm.member_id}
                onChange={(e) =>
                  setAppForm({ ...appForm, member_id: e.target.value })
                }
                required
              >
                {memberOptions}
              </select>
            </label>
            {field(
              'amount',
              'Kiasi kinachoombwa (TZS)',
              'Requested amount (TZS)',
              appForm.requested_amount_tzs,
              (v) => setAppForm({ ...appForm, requested_amount_tzs: v }),
              'number',
              true
            )}
            <label className="ec-field">
              {t(
                'Fomu ya maombi iliyojazwa na kusainiwa',
                'Completed and signed application form'
              )}
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setAppFile(e.target.files?.[0] || null)}
                required
              />
            </label>
            <label className="ec-field">
              {t('Mpango wa biashara', 'Business plan')}
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => setBusinessFile(e.target.files?.[0] || null)}
                required
              />
            </label>
          </div>
          <p className="ec-hint">
            {t(
              'Uthibitisho wa mashahidi wawili/idadi iliyokubaliwa na hatua za WCS Staff, Coordinator, Group Chairperson, Secretary, Treasurer na Bank Representative vitasimamiwa kwenye approval workflow.',
              'Witness verification and the agreed approval stages are handled in the approval workflow.'
            )}
          </p>
          <button className="primary-btn" disabled={loading}>
            {t('Wasilisha ombi', 'Submit application')}
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Application Ref</th>
                <th>Member</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>{a.application_ref}</td>
                  <td>{member(a.member_id)?.full_name || '—'}</td>
                  <td>{money(a.requested_amount_tzs)}</td>
                  <td>{a.status}</td>
                  <td>{a.submitted_at || a.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }
  if (!logged)
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="language-switch auth-language">
            <button
              onClick={() => setLanguage('sw')}
              className={language === 'sw' ? 'selected' : ''}
            >
              Kiswahili
            </button>
            <button
              onClick={() => setLanguage('en')}
              className={language === 'en' ? 'selected' : ''}
            >
              English
            </button>
          </div>
          <div className="brand-mark">E</div>
          <h1>ECO CONNECT</h1>
          <p className="muted">Hisa Eco Save &amp; Credit Management</p>
          <form className="auth-form" onSubmit={login}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label>{t('Nywila', 'Password')}</label>
            <div className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="show-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Ficha' : 'Onyesha'}
              </button>
            </div>
            <button className="primary-btn" disabled={loading}>
              {loading
                ? t('Inaingia...', 'Signing in...')
                : t('Ingia', 'Sign in')}
            </button>
            {message && <p className="notice">{message}</p>}
          </form>
          <p className="auth-footer">Wildlife Conservation Society</p>
        </section>
      </main>
    );
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">E</div>
          <div>
            <strong>ECO CONNECT</strong>
            <span>MFUMO</span>
          </div>
        </div>
        <div className="nav-caption">{t('MENYU KUU', 'MAIN MENU')}</div>
        <nav className="main-nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={active === n.id ? 'nav-link active' : 'nav-link'}
              onClick={() => {
                setActive(n.id);
                setMessage('');
                setSearch('');
                setSubView('list');
                setSelectedGroup('ALL');
              }}
            >
              <span className="nav-icon">{n.icon}</span>
              {n[language === 'sw' ? 'sw' : 'en']}
            </button>
          ))}
        </nav>
        <button className="nav-link logout-link" onClick={logout}>
          ↪ {t('Toka', 'Sign out')}
        </button>
        <div className="sidebar-footer">
          ECO CONNECT
          <br />
          <span>Hisa Eco Save &amp; Credit</span>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="eyebrow">ECO CONNECT</div>
            <h1>{title}</h1>
          </div>
          <div className="topbar-right">
            <div className="language-switch">
              <button
                className={language === 'sw' ? 'selected' : ''}
                onClick={() => setLanguage('sw')}
              >
                Kiswahili
              </button>
              <button
                className={language === 'en' ? 'selected' : ''}
                onClick={() => setLanguage('en')}
              >
                English
              </button>
            </div>
            <div className="profile-chip">
              <div className="avatar">CH</div>
              <div>
                <strong>System Administrator</strong>
                <span>{t('Msimamizi wa mfumo', 'System Administrator')}</span>
              </div>
            </div>
          </div>
        </header>
        <div className="content-area">
          <div className="access-line">
            <span className="status-dot" />
            {t(
              'Ufikiaji: System Administrator • Vikundi vyote',
              'Access: System Administrator • All groups'
            )}
          </div>
          {message && <div className="notice">{message}</div>}
          {loading && (
            <div className="ec-hint">{t('Inapakia...', 'Loading...')}</div>
          )}
          {active === 'dashboard' ? (
            <>
              <div className="stats-grid">
                <article className="stat-card">
                  <div className="stat-top">
                    {t('Wanachama hai', 'Active members')}
                  </div>
                  <strong>
                    {
                      members.filter(
                        (m) =>
                          m.registration_status !== 'INACTIVE' &&
                          m.registration_status !== 'EXITED'
                      ).length
                    }
                  </strong>
                </article>
                <article className="stat-card">
                  <div className="stat-top">{t('Vikundi', 'Groups')}</div>
                  <strong>{groups.length}</strong>
                </article>
                <article className="stat-card">
                  <div className="stat-top">
                    {t('Miamala ya akiba', 'Deposits')}
                  </div>
                  <strong>{transactions.length}</strong>
                </article>
                <article className="stat-card">
                  <div className="stat-top">Loan Register</div>
                  <strong>{loans.length}</strong>
                </article>
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <h3>{t('Muhtasari wa vikundi', 'Group overview')}</h3>
                    <p>
                      {t(
                        'Takwimu za sasa kutoka database.',
                        'Current database records.'
                      )}
                    </p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('Kikundi', 'Group')}</th>
                        <th>{t('Wanachama hai', 'Active members')}</th>
                        <th>{t('Amana', 'Deposits')}</th>
                        <th>{t('Mikopo', 'Loans')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <tr key={g.id}>
                          <td>{g.group_name}</td>
                          <td>
                            {
                              members.filter(
                                (m) =>
                                  m.group_id === g.id &&
                                  m.registration_status !== 'INACTIVE' &&
                                  m.registration_status !== 'EXITED'
                              ).length
                            }
                          </td>
                          <td>
                            {money(
                              transactions
                                .filter(
                                  (x) =>
                                    x.group_id === g.id &&
                                    x.deposit_type === 'CASH DEPOSIT'
                                )
                                .reduce((a, x) => a + Number(x.amount_tzs), 0)
                            )}
                          </td>
                          <td>
                            {money(
                              loans
                                .filter((x) => x.group_id === g.id)
                                .reduce(
                                  (a, x) => a + Number(x.loan_received_tzs),
                                  0
                                )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : active === 'members' ? (
            membersPage()
          ) : active === 'transactions' ? (
            transactionsPage()
          ) : active === 'loans' ? (
            loansPage()
          ) : active === 'sms' ? (
            smsPage()
          ) : active === 'applications' ? (
            applicationsPage()
          ) : active === 'groups' ? (
            <div className="panel">
              <h2>{t('Vikundi', 'Groups')}</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Kikundi', 'Group')}</th>
                      <th>Shehia</th>
                      <th>{t('Kijiji', 'Village')}</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.id}>
                        <td>{g.group_name}</td>
                        <td>{g.shehia || '—'}</td>
                        <td>{g.village || '—'}</td>
                        <td>{g.is_active ? 'Active' : 'Inactive'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : active === 'reports' ? (
            <div className="panel">
              <h2>{t('Ripoti na upakuaji', 'Reports & downloads')}</h2>
              <p>
                {t(
                  'Pakua data kwa vikundi vyote au chagua kikundi kupitia kurasa husika.',
                  'Download all records or filter by group on the relevant pages.'
                )}
              </p>
              <div className="ec-actions">
                <button
                  className="secondary-btn"
                  onClick={() =>
                    downloadCsv('ECO_CONNECT_MEMBERS.csv', members)
                  }
                >
                  Wanachama CSV
                </button>
                <button
                  className="secondary-btn"
                  onClick={() =>
                    downloadCsv('ECO_CONNECT_DEPOSITS.csv', transactions)
                  }
                >
                  Deposits CSV
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => downloadCsv('ECO_CONNECT_LOANS.csv', loans)}
                >
                  Loan Register CSV
                </button>
                <button
                  className="secondary-btn"
                  onClick={() => downloadCsv('ECO_CONNECT_SMS.csv', smsRows)}
                >
                  SMS CSV
                </button>
              </div>
            </div>
          ) : (
            <div className="panel">
              <div className="feature-placeholder">
                <h3>{title}</h3>
                <p>
                  {t(
                    'Sehemu hii itaunganishwa na huduma zake baada ya kukamilisha uthibitisho wa database na ruhusa.',
                    'This section will be connected after database and permission verification.'
                  )}
                </p>
              </div>
            </div>
          )}
          <footer className="page-footer">
            ECO CONNECT <span>•</span> Hisa Eco Save &amp; Credit
          </footer>
        </div>
      </main>
    </div>
  );
}
export default App;
