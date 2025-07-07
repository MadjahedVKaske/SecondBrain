import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Play,
  RotateCcw,
  FileText
} from "lucide-react";

const Audit = () => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [testStarted, setTestStarted] = useState(false);
  const [testCompleted, setTestCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const questions = [
    {
      id: 1,
      question: "Как часто вы обновляете конфигурацию 1С?",
      answers: [
        { id: "a", text: "Регулярно, следим за релизами", points: 3 },
        { id: "b", text: "Иногда, когда есть проблемы", points: 2 },
        { id: "c", text: "Редко или никогда", points: 1 },
        { id: "d", text: "Не знаю, как обновлять", points: 0 }
      ]
    },
    {
      id: 2,
      question: "Есть ли у вас резервные копии базы данных?",
      answers: [
        { id: "a", text: "Да, делаем ежедневно автоматически", points: 3 },
        { id: "b", text: "Да, делаем вручную периодически", points: 2 },
        { id: "c", text: "Иногда забываем", points: 1 },
        { id: "d", text: "Нет, не делаем резервные копии", points: 0 }
      ]
    },
    {
      id: 3,
      question: "Как работает ваша система 1С по скорости?",
      answers: [
        { id: "a", text: "Работает быстро, без задержек", points: 3 },
        { id: "b", text: "Иногда подтормаживает", points: 2 },
        { id: "c", text: "Часто работает медленно", points: 1 },
        { id: "d", text: "Очень медленно, постоянно зависает", points: 0 }
      ]
    },
    {
      id: 4,
      question: "Настроены ли права доступа пользователей?",
      answers: [
        { id: "a", text: "Да, у каждого свои права", points: 3 },
        { id: "b", text: "Частично настроены", points: 2 },
        { id: "c", text: "Все работают под одним пользователем", points: 1 },
        { id: "d", text: "Не знаю, что это", points: 0 }
      ]
    },
    {
      id: 5,
      question: "Ведется ли техническое сопровождение системы?",
      answers: [
        { id: "a", text: "Да, есть договор с 1С-партнером", points: 3 },
        { id: "b", text: "Иногда обращаемся за помощью", points: 2 },
        { id: "c", text: "Решаем проблемы самостоятельно", points: 1 },
        { id: "d", text: "Никто не занимается", points: 0 }
      ]
    }
  ];

  const handleAnswer = (answerPoints) => {
    const newAnswers = { ...answers, [currentQuestion]: answerPoints };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Тест завершен
      const totalScore = Object.values(newAnswers).reduce((sum: number, points: number) => sum + points, 0);
      setScore(totalScore);
      setTestCompleted(true);
    }
  };

  const getScoreStatus = () => {
    const percentage = (score / 15) * 100;
    if (percentage >= 80) return { status: "excellent", icon: CheckCircle2, color: "text-green-600" };
    if (percentage >= 60) return { status: "good", icon: CheckCircle2, color: "text-blue-600" };
    if (percentage >= 40) return { status: "average", icon: AlertTriangle, color: "text-yellow-600" };
    return { status: "poor", icon: XCircle, color: "text-red-600" };
  };

  const getRecommendation = () => {
    const percentage = (score / 15) * 100;
    if (percentage >= 80) {
      return {
        title: "Отличное состояние!",
        description: "Ваша система 1С настроена правильно и работает эффективно.",
        recommendations: [
          "Продолжайте регулярно обновлять систему",
          "Поддерживайте текущий уровень безопасности",
          "Рассмотрите возможность дополнительной оптимизации"
        ]
      };
    } else if (percentage >= 60) {
      return {
        title: "Хорошее состояние",
        description: "Система работает неплохо, но есть возможности для улучшения.",
        recommendations: [
          "Улучшите систему резервного копирования",
          "Оптимизируйте производительность",
          "Настройте права доступа пользователей"
        ]
      };
    } else if (percentage >= 40) {
      return {
        title: "Требуется внимание",
        description: "Система работает, но есть серьезные проблемы, которые нужно решить.",
        recommendations: [
          "Обновите конфигурацию до актуальной версии",
          "Настройте автоматическое резервное копирование",
          "Проведите оптимизацию производительности",
          "Организуйте техническое сопровождение"
        ]
      };
    } else {
      return {
        title: "Критическое состояние",
        description: "Система требует срочного вмешательства специалистов.",
        recommendations: [
          "Срочно обратитесь к специалистам 1С",
          "Проведите полный аудит системы",
          "Настройте резервное копирование",
          "Обновите и оптимизируйте систему",
          "Организуйте постоянное техническое сопровождение"
        ]
      };
    }
  };

  const resetTest = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setTestStarted(false);
    setTestCompleted(false);
    setScore(0);
  };

  if (!testStarted && !testCompleted) {
    return (
      <Layout>
        <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
                В порядке ли у меня 1С?
              </h1>
              <p className="text-xl text-muted-foreground mb-12">
                Бесплатный тест для оценки состояния вашей системы 1С. 
                Займет всего 2-3 минуты и покажет, что нужно улучшить.
              </p>

              <Card className="border-border text-left mb-8">
                <CardHeader>
                  <CardTitle className="text-2xl">Что вы узнаете:</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-center space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>Оценку текущего состояния системы</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>Конкретные рекомендации по улучшению</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>Приоритетность задач по оптимизации</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>Возможность получить бесплатную консультацию</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Button 
                variant="hero" 
                size="xl" 
                onClick={() => setTestStarted(true)}
                className="group"
              >
                <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                Начать тест
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (testCompleted) {
    const { status, icon: StatusIcon, color } = getScoreStatus();
    const recommendation = getRecommendation();

    return (
      <Layout>
        <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
                  Результаты теста
                </h1>
                <p className="text-xl text-muted-foreground">
                  Ваша оценка: {score} из 15 баллов ({Math.round((score / 15) * 100)}%)
                </p>
              </div>

              <Card className="border-border mb-8">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <StatusIcon className={`w-12 h-12 ${color}`} />
                    <div>
                      <CardTitle className="text-3xl">{recommendation.title}</CardTitle>
                      <CardDescription className="text-lg mt-2">
                        {recommendation.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-4">Рекомендации:</h3>
                      <ul className="space-y-3">
                        {recommendation.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start space-x-3">
                            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6">
                      <Button variant="default" size="lg">
                        Заказать аудит
                      </Button>
                      <Button variant="outline" size="lg">
                        Получить консультацию
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="lg" 
                        onClick={resetTest}
                        className="flex items-center space-x-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Пройти еще раз</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border bg-gradient-to-r from-primary/5 to-accent/5">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-3">
                    <FileText className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">
                        Нужен профессиональный аудит?
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Наши эксперты проведут детальный анализ вашей системы 1С 
                        и предоставят подробный отчет с планом оптимизации.
                      </p>
                      <Button variant="outline">
                        Заказать полный аудит
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-foreground mb-4">
                Тест состояния 1С
              </h1>
              <p className="text-muted-foreground">
                Вопрос {currentQuestion + 1} из {questions.length}
              </p>
              <Progress 
                value={((currentQuestion + 1) / questions.length) * 100} 
                className="mt-4" 
              />
            </div>

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-2xl">
                  {questions[currentQuestion].question}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {questions[currentQuestion].answers.map((answer) => (
                    <button
                      key={answer.id}
                      onClick={() => handleAnswer(answer.points)}
                      className="w-full p-4 text-left rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {answer.text}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Audit;