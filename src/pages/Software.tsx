import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const Software = () => {
  const versions = [
    { name: "Стандарт", description: "Минимальный функционал", mode: "Офлайн-режим" },
    { name: "Стандарт Pro", description: "Расширенная версия", mode: "Офлайн-режим" },
    { name: "Online Lite", description: "Базовый онлайн", mode: "Онлайн-режим" },
    { name: "Online", description: "Расширенный функционал", mode: "Онлайн-режим" }
  ];

  const solutions = [
    "DM.Доставка Pro — решение для автоматизации курьеров в соответствии с требованиями 54-ФЗ",
    "DM.Invent — ПО для учета основных средств на предприятии, в том числе с использованием RFID-технологии",
    "DM.ТОИР — ПО для контроля состояния основных средств и работы сервисных служб",
    "DM.Прайсчекер — программа для стационарных информационных киосков"
  ];

  const tasks = [
    "идентификация товара",
    "приемка, отпуск и перемещение продукции",
    "инвентаризация",
    "сбор заказов",
    "адресное хранение",
    "проверка ценников, переоценка"
  ];

  const advantages = [
    "быстрая установка и простая интеграция с учетной системой",
    "удобный и понятный интерфейс",
    "параметрическая настройка бизнес-процессов (без программирования)",
    "несколько способов обмена данными в режимах офлайн и онлайн",
    "регулярные обновления",
    "возможность расширения функциональности с сохранением настроек базы",
    "быстрая и бесплатная техподдержка"
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Программное обеспечение DataMobile
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Специализированные программные продукты для автоматизации бизнеса
          </p>
        </div>

        {/* Main Description */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="prose max-w-none">
              <p className="text-lg leading-relaxed mb-6">
                Мы разрабатываем и внедряем мобильные бизнес-решения для автоматизации склада, 
                торговли, производства, логистики, учета маркированной и алкогольной продукции.
              </p>
              <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-6">
                В портфеле нашей компании решения для учета на базе штрихкодирования, 
                а также с использованием RFID-технологии.
              </blockquote>
              <p className="mb-4">
                Программное обеспечение DataMobile предназначено для терминалов сбора данных (ТСД) 
                и других мобильных устройств на Android.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>ПО решает ряд типовых и специализированных задач</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>{task}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Advantages Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Основные преимущества ПО DataMobile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {advantages.map((advantage, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{advantage}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Versions Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>DataMobile доступно в 4 версиях</CardTitle>
            <CardDescription>
              Программа масштабируется путем апгрейда с одной версии на последующую
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {versions.map((version, index) => (
                <Card key={index} className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{version.name}</CardTitle>
                    <Badge variant="secondary">{version.mode}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{version.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Modules Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>К DataMobile можно подключить модули</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Маркировка</h3>
              <p className="text-muted-foreground">
                Решение для учета товаров, прослеживаемых через систему «Честный ЗНАК»
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">RFID</h3>
              <p className="text-muted-foreground">
                Для использования устройств с RFID-считывателем и учета по радиочастотным меткам
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Other Solutions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Другие решения в продуктовой линейке</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {solutions.map((solution, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{solution}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Стоимость программного обеспечения</CardTitle>
            <CardDescription>
              Актуальные цены на лицензии DataMobile и специализированные решения
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {/* DataMobile Base Versions */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Основные версии DataMobile</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Стандарт</CardTitle>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">936 ₽</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Артикул: 119000</p>
                      <p className="text-sm">Минимальный функционал</p>
                      <Badge variant="secondary" className="mt-2">Офлайн-режим</Badge>
                    </CardContent>
                  </Card>
                  
                  <Card className="border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Стандарт Pro</CardTitle>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">1 716 ₽</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Артикул: 119100</p>
                      <p className="text-sm">Расширенная версия</p>
                      <Badge variant="secondary" className="mt-2">Офлайн-режим</Badge>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Online Lite</CardTitle>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">2 496 ₽</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Артикул: 119200</p>
                      <p className="text-sm">Базовый онлайн</p>
                      <Badge variant="secondary" className="mt-2">Онлайн-режим</Badge>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Online</CardTitle>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">3 120 ₽</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Артикул: 119300</p>
                      <p className="text-sm">Расширенный функционал</p>
                      <Badge variant="secondary" className="mt-2">Онлайн-режим</Badge>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">DataMobile LifeTime версии</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between items-center">
                      <span>DataMobile Стандарт - LifeTime</span>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">6 300 ₽</span>
                        <p className="text-xs text-muted-foreground">Артикул: 119004</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Specialized Solutions */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Специализированные решения</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">DM.Invent</CardTitle>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">2 700 ₽</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Артикул: 119600</p>
                      <p className="text-sm">Решение для инвентаризации основных средств</p>
                    </CardContent>
                  </Card>

                  <Card className="border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">DM.ТОИР</CardTitle>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">2 925 ₽</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Артикул: 119650</p>
                      <p className="text-sm">Для автоматизации работы сервисных служб</p>
                    </CardContent>
                  </Card>
                </div>

                {/* RFID Modules */}
                <div className="mt-6">
                  <h4 className="font-semibold mb-3">RFID модули</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium">Модуль RFID для DM.Invent</h5>
                        <span className="text-lg font-bold text-primary">5 400 ₽</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Артикул: 120000</p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium">Модуль RFID для DM.ТОИР</h5>
                        <span className="text-lg font-bold text-primary">5 925 ₽</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Артикул: 120800</p>
                    </div>
                  </div>
                </div>

                {/* Subscription */}
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Дополнительные услуги</h4>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">Подписка на обновления ПО DM.Основные средства</span>
                      <p className="text-sm text-muted-foreground">для версий LifeTime</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-primary">7 080 ₽</span>
                      <p className="text-xs text-muted-foreground">Артикул: 120600</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DataMobile Delivery Pro Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>DM.Доставка Pro</CardTitle>
            <CardDescription>
              Программное обеспечение для автоматизации полного цикла работы службы доставки
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Службам доставки</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Постановка и отслеживание заданий для курьеров
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Торговым компаниям</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Оптимизация маршрута и доставка продукции без задержек
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Интернет-магазинам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Автоматизация процессов доставки на всех уровнях
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Ключевые особенности</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <span>Соответствие требованиям ФЗ-54</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <span>Совместимость с облачной кассой</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <span>Интеграция с платежными сервисами</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <span>Поддержка банковских терминалов</span>
                  </div>
                </div>
              </div>

              {/* Pricing for DM.Доставка Pro */}
              <div className="border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Стоимость лицензии</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">DM.Доставка Pro</CardTitle>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-medium text-muted-foreground">По запросу</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">Индивидуальная стоимость</p>
                      <p className="text-sm">Для автоматизации курьерских служб</p>
                      <Badge variant="secondary" className="mt-2">Полный функционал</Badge>
                    </CardContent>
                  </Card>
                  
                  <div className="flex flex-col justify-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Стоимость лицензии зависит от количества пользователей и функциональных требований
                    </p>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>
                        <span>Работа с маркированными товарами</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>
                        <span>Множественные способы оплаты</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>
                        <span>Навигация и построение маршрутов</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* DM.Прайсчекер */}
              <Card className="border">
                <CardHeader>
                  <CardTitle className="text-xl">DM.Прайсчекер</CardTitle>
                  <p className="text-muted-foreground">
                    Для микрокиосков и прайсчекеров
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">
                    Программное обеспечение позволяет получать актуальные сведения о товаре при сканировании штрихкода
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Торговые залы</h4>
                      <p className="text-sm text-muted-foreground">Актуальная информация о ценах и маркировке товара</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Продуктовый ритейл</h4>
                      <p className="text-sm text-muted-foreground">Информация о продукции, повышение лояльности покупателей</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">Розница</h4>
                      <p className="text-sm text-muted-foreground">Реклама, акции, изображение и описание товара</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium">Ключевые возможности:</h4>
                    <ul className="text-sm space-y-1">
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>
                        <span>Сканирование штрихкодов и получение информации о товаре</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>
                        <span>Отображение актуальных цен и акций</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>
                        <span>Рекламные материалы и промо-контент</span>
                      </li>
                      <li className="flex items-start space-x-2">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2"></div>
                        <span>Простая интеграция с существующими системами</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Тарифные пакеты:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Пакет Старт */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium mb-2">Пакет «Старт»</h5>
                        <div className="text-sm text-muted-foreground mb-2">100 документов/год • 15,6 ₽/док.</div>
                        <div className="text-2xl font-bold mb-3">1 560 ₽</div>
                        <div className="text-sm mb-3">
                          <div className="font-medium mb-1">Кому подойдет:</div>
                          <ul className="space-y-1">
                            <li>• Разовые доставки</li>
                            <li>• Тестирование</li>
                          </ul>
                        </div>
                        <Button size="sm" variant="outline" className="w-full">Купить</Button>
                      </div>

                      {/* Пакет Базовый */}
                      <div className="border rounded-lg p-4 relative bg-primary text-primary-foreground">
                        <div className="absolute -top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">ХИТ</div>
                        <h5 className="font-medium mb-2">Пакет «Базовый»</h5>
                        <div className="text-sm opacity-80 mb-2">1 000 документов/год • 9,1 ₽/док.</div>
                        <div className="text-2xl font-bold mb-3">9 100 ₽</div>
                        <div className="text-sm mb-3">
                          <div className="font-medium mb-1">Кому подойдет:</div>
                          <ul className="space-y-1">
                            <li>• Малый бизнес</li>
                            <li>• Старт автоматизации</li>
                          </ul>
                        </div>
                        <Button size="sm" variant="secondary" className="w-full">Купить</Button>
                      </div>

                      {/* Пакет Оптима */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium mb-2">Пакет «Оптима»</h5>
                        <div className="text-sm text-muted-foreground mb-2">5 000 документов/год • 6,5 ₽/док.</div>
                        <div className="text-2xl font-bold mb-3">32 500 ₽</div>
                        <div className="text-sm mb-3">
                          <div className="font-medium mb-1">Кому подойдет:</div>
                          <ul className="space-y-1">
                            <li>• Небольшие сети</li>
                            <li>• Рост заказов</li>
                          </ul>
                        </div>
                        <Button size="sm" variant="outline" className="w-full">Купить</Button>
                      </div>

                      {/* Пакет Проф */}
                      <div className="border rounded-lg p-4">
                        <h5 className="font-medium mb-2">Пакет «Проф»</h5>
                        <div className="text-sm text-muted-foreground mb-2">30 000 документов/год • 3,9 ₽/док.</div>
                        <div className="text-2xl font-bold mb-3">117 000 ₽</div>
                        <div className="text-sm mb-3">
                          <div className="font-medium mb-1">Кому подойдет:</div>
                          <ul className="space-y-1">
                            <li>• Устойчивый поток</li>
                            <li>• B2C сегмент</li>
                          </ul>
                        </div>
                        <Button size="sm" variant="outline" className="w-full">Купить</Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button size="sm">
                      Скачать DM.Прайсчекер
                    </Button>
                    <Button variant="outline" size="sm">
                      Подобрать решение
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="text-center">
                <Button size="lg" className="mr-4">
                  Получить коммерческое предложение
                </Button>
                <Button variant="outline" size="lg">
                  Попробовать бесплатно
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* License Options */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Варианты приобретения лицензии</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3">Lifetime</h3>
                <p className="text-muted-foreground mb-4">
                  Бессрочное пользование — привязывается к одному устройству
                </p>
                <Badge variant="outline">Единоразовая покупка</Badge>
              </div>
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3">Подписка DMcloud</h3>
                <p className="text-muted-foreground mb-4">
                  Облачный сервис на 1, 6 или 12 месяцев с личным кабинетом для управления лицензиями
                </p>
                <Badge variant="outline">Гибкое управления</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration */}
        <Card className="mb-8">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Интеграция с учетными системами</h2>
            <p className="text-lg text-muted-foreground mb-6">
              ПО DataMobile интегрируется с большинством товароучетных систем. 
              Для 1С существуют готовые интерфейсы обмена. Предприятия с другими системами 
              могут внедрить DataMobile благодаря открытым форматам обмена данными.
            </p>
            <div className="space-y-4">
              <p className="font-medium">
                Наша компания оказывает услуги по настройке и внедрению программного обеспечения, 
                а также доработки функционала под индивидуальные нужды заказчика.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Готовы автоматизировать свой бизнес?</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Получите консультацию по выбору оптимального решения для вашей компании
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg">Запросить демонстрацию</Button>
              <Button variant="outline" size="lg">Получить коммерческое предложение</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Software;
